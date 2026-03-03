import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../db";
import { userFavoriteVideosTable } from "../entities/UserFavoriteVideo";
import { userVideoHistoriesTable } from "../entities/UserVideoHistory";
import { videosTable } from "../entities/Video";
import type { PaginatedResult } from "../utils/pagination";
import { videosService } from "./videos";

type VideoHistoryState = {
  progressSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  lastPlayedAt: Date;
};

export type VideoInteractionState = {
  isFavorite: boolean;
  history: VideoHistoryState | null;
};

export type VideoHistoryListItem = VideoHistoryState & {
  video: unknown;
};

class UserVideoInteractionsService {
  private async videoExists(videoId: number): Promise<boolean> {
    const item = await db.query.videosTable.findFirst({
      where: eq(videosTable.id, videoId),
      columns: { id: true },
    });
    return item != null;
  }

  private normalizeDuration(durationSeconds?: number | null): number | null {
    if (durationSeconds == null || !Number.isFinite(durationSeconds)) return null;
    return Math.max(0, Math.floor(durationSeconds));
  }

  private normalizeProgress(progressSeconds: number, durationSeconds: number | null): number {
    if (!Number.isFinite(progressSeconds)) return 0;
    const normalized = Math.max(0, Math.floor(progressSeconds));
    if (durationSeconds == null) return normalized;
    return Math.min(normalized, durationSeconds);
  }

  private toHistoryState(history: typeof userVideoHistoriesTable.$inferSelect): VideoHistoryState {
    return {
      progressSeconds: history.progressSeconds,
      durationSeconds: history.durationSeconds,
      completed: history.completed,
      lastPlayedAt: history.lastPlayedAt,
    };
  }

  private normalizeKeyword(keyword?: string) {
    const value = keyword?.trim();
    return value ? value : undefined;
  }

  private async buildVideoMap(videoIds: number[]) {
    const videos = await videosService.findManyByIds(videoIds, { useCommonUrl: true, pathOnly: true });
    const map = new Map<number, unknown>();
    for (const video of videos) {
      const id = (video as { id?: unknown } | null)?.id;
      if (video && typeof id === "number") {
        map.set(id, video);
      }
    }
    return map;
  }

  async getInteractionState(userId: number, videoId: number): Promise<VideoInteractionState | null> {
    const exists = await this.videoExists(videoId);
    if (!exists) return null;

    const [favorite, history] = await Promise.all([
      db.query.userFavoriteVideosTable.findFirst({
        where: and(eq(userFavoriteVideosTable.userId, userId), eq(userFavoriteVideosTable.videoId, videoId)),
        columns: { userId: true },
      }),
      db.query.userVideoHistoriesTable.findFirst({
        where: and(eq(userVideoHistoriesTable.userId, userId), eq(userVideoHistoriesTable.videoId, videoId)),
      }),
    ]);

    return {
      isFavorite: favorite != null,
      history: history ? this.toHistoryState(history) : null,
    };
  }

  async setFavorite(userId: number, videoId: number, favorite: boolean): Promise<{ error?: string; isFavorite?: boolean }> {
    const exists = await this.videoExists(videoId);
    if (!exists) return { error: "视频不存在" };

    if (favorite) {
      await db.insert(userFavoriteVideosTable).values({ userId, videoId }).onConflictDoNothing();
      return { isFavorite: true };
    }

    await db
      .delete(userFavoriteVideosTable)
      .where(and(eq(userFavoriteVideosTable.userId, userId), eq(userFavoriteVideosTable.videoId, videoId)));
    return { isFavorite: false };
  }

  async upsertHistory(
    userId: number,
    videoId: number,
    payload: {
      progressSeconds: number;
      durationSeconds?: number | null;
      completed?: boolean;
    }
  ): Promise<{ error?: string; history?: VideoHistoryState }> {
    const exists = await this.videoExists(videoId);
    if (!exists) return { error: "视频不存在" };

    const durationSeconds = this.normalizeDuration(payload.durationSeconds);
    const progressSeconds = this.normalizeProgress(payload.progressSeconds, durationSeconds);
    const autoCompleted =
      durationSeconds != null &&
      durationSeconds > 0 &&
      progressSeconds >= Math.max(0, durationSeconds - 3);
    const completed = Boolean(payload.completed) || autoCompleted;
    const playCountDelta = payload.completed === true ? 1 : 0;
    const storedProgressSeconds = progressSeconds;
    const now = new Date();

    await db
      .insert(userVideoHistoriesTable)
      .values({
        userId,
        videoId,
        progressSeconds: storedProgressSeconds,
        playCount: playCountDelta,
        durationSeconds,
        completed,
        lastPlayedAt: now,
      })
      .onConflictDoUpdate({
        target: [userVideoHistoriesTable.userId, userVideoHistoriesTable.videoId],
        set: {
          progressSeconds: storedProgressSeconds,
          playCount: sql<number>`${userVideoHistoriesTable.playCount} + ${playCountDelta}`,
          durationSeconds,
          completed,
          lastPlayedAt: now,
          updatedAt: now,
        },
      });

    return {
      history: {
        progressSeconds: storedProgressSeconds,
        durationSeconds,
        completed,
        lastPlayedAt: now,
      },
    };
  }

  async listFavorites(
    userId: number,
    page: number,
    pageSize: number,
    offset: number,
    options?: { keyword?: string }
  ): Promise<PaginatedResult<unknown>> {
    const keyword = this.normalizeKeyword(options?.keyword);
    const where = keyword
      ? and(
          eq(userFavoriteVideosTable.userId, userId),
          ilike(videosTable.title, `%${keyword}%`)
        )
      : eq(userFavoriteVideosTable.userId, userId);

    const [rows, total] = await Promise.all([
      db
        .select({
          videoId: userFavoriteVideosTable.videoId,
          createdAt: userFavoriteVideosTable.createdAt,
        })
        .from(userFavoriteVideosTable)
        .innerJoin(videosTable, eq(videosTable.id, userFavoriteVideosTable.videoId))
        .where(where)
        .orderBy(desc(userFavoriteVideosTable.createdAt), desc(userFavoriteVideosTable.videoId))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(userFavoriteVideosTable)
        .innerJoin(videosTable, eq(videosTable.id, userFavoriteVideosTable.videoId))
        .where(where),
    ]);

    const videoMap = await this.buildVideoMap(rows.map((row) => row.videoId));
    const items = rows
      .map((row) => videoMap.get(row.videoId))
      .filter((item): item is unknown => item != null);

    return {
      page,
      pageSize,
      total: Number(total[0]?.count ?? 0),
      items,
    };
  }

  async listHistory(
    userId: number,
    page: number,
    pageSize: number,
    offset: number,
    options?: { keyword?: string }
  ): Promise<PaginatedResult<VideoHistoryListItem>> {
    const keyword = this.normalizeKeyword(options?.keyword);
    const where = keyword
      ? and(
          eq(userVideoHistoriesTable.userId, userId),
          ilike(videosTable.title, `%${keyword}%`)
        )
      : eq(userVideoHistoriesTable.userId, userId);

    const [rows, total] = await Promise.all([
      db
        .select({
          videoId: userVideoHistoriesTable.videoId,
          progressSeconds: userVideoHistoriesTable.progressSeconds,
          durationSeconds: userVideoHistoriesTable.durationSeconds,
          completed: userVideoHistoriesTable.completed,
          lastPlayedAt: userVideoHistoriesTable.lastPlayedAt,
        })
        .from(userVideoHistoriesTable)
        .innerJoin(videosTable, eq(videosTable.id, userVideoHistoriesTable.videoId))
        .where(where)
        .orderBy(desc(userVideoHistoriesTable.lastPlayedAt), desc(userVideoHistoriesTable.videoId))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(userVideoHistoriesTable)
        .innerJoin(videosTable, eq(videosTable.id, userVideoHistoriesTable.videoId))
        .where(where),
    ]);

    const videoMap = await this.buildVideoMap(rows.map((row) => row.videoId));

    const items: VideoHistoryListItem[] = [];
    for (const row of rows) {
      const video = videoMap.get(row.videoId);
      if (!video) continue;
      items.push({
        video,
        progressSeconds: row.progressSeconds,
        durationSeconds: row.durationSeconds,
        completed: row.completed,
        lastPlayedAt: row.lastPlayedAt,
      });
    }

    return {
      page,
      pageSize,
      total: Number(total[0]?.count ?? 0),
      items,
    };
  }
}

export const userVideoInteractionsService = new UserVideoInteractionsService();
