import { and, desc, eq } from "drizzle-orm";
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
    const storedProgressSeconds = completed ? 0 : progressSeconds;
    const now = new Date();

    await db
      .insert(userVideoHistoriesTable)
      .values({
        userId,
        videoId,
        progressSeconds: storedProgressSeconds,
        durationSeconds,
        completed,
        lastPlayedAt: now,
      })
      .onConflictDoUpdate({
        target: [userVideoHistoriesTable.userId, userVideoHistoriesTable.videoId],
        set: {
          progressSeconds: storedProgressSeconds,
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
    offset: number
  ): Promise<PaginatedResult<unknown>> {
    const [rows, total] = await Promise.all([
      db.query.userFavoriteVideosTable.findMany({
        where: eq(userFavoriteVideosTable.userId, userId),
        columns: { videoId: true, createdAt: true },
        orderBy: (table, op) => [op.desc(table.createdAt), op.desc(table.videoId)],
        limit: pageSize,
        offset,
      }),
      db.$count(userFavoriteVideosTable, eq(userFavoriteVideosTable.userId, userId)),
    ]);

    const videos = await Promise.all(
      rows.map((row) => videosService.findById(row.videoId, { useCommonUrl: true, pathOnly: true }))
    );
    const videoMap = new Map<number, unknown>();
    for (const video of videos) {
      const id = (video as { id?: unknown } | null)?.id;
      if (video && typeof id === "number") {
        videoMap.set(id, video);
      }
    }
    const items = rows
      .map((row) => videoMap.get(row.videoId))
      .filter((item): item is unknown => item != null);

    return {
      page,
      pageSize,
      total: total ?? 0,
      items,
    };
  }

  async listHistory(
    userId: number,
    page: number,
    pageSize: number,
    offset: number
  ): Promise<PaginatedResult<VideoHistoryListItem>> {
    const [rows, total] = await Promise.all([
      db.query.userVideoHistoriesTable.findMany({
        where: eq(userVideoHistoriesTable.userId, userId),
        orderBy: [desc(userVideoHistoriesTable.lastPlayedAt), desc(userVideoHistoriesTable.videoId)],
        limit: pageSize,
        offset,
      }),
      db.$count(userVideoHistoriesTable, eq(userVideoHistoriesTable.userId, userId)),
    ]);

    const videos = await Promise.all(
      rows.map((row) => videosService.findById(row.videoId, { useCommonUrl: true, pathOnly: true }))
    );
    const videoMap = new Map<number, unknown>();
    for (const video of videos) {
      const id = (video as { id?: unknown } | null)?.id;
      if (video && typeof id === "number") {
        videoMap.set(id, video);
      }
    }

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
      total: total ?? 0,
      items,
    };
  }
}

export const userVideoInteractionsService = new UserVideoInteractionsService();
