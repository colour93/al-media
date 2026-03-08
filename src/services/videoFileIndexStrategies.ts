import { and, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db";
import {
  videoFileIndexStrategiesTable,
  type NewVideoFileIndexStrategy,
  type VideoFileIndexStrategy,
} from "../entities/VideoFileIndexStrategy";
import { videoFilesTable } from "../entities/VideoFile";
import { fileDirsTable } from "../entities/FileDir";
import type { PaginatedResult } from "../utils/pagination";
import { parseRegexInput } from "../utils/regex";
import { videoFilesService } from "./videoFiles";

export type VideoFileIndexStrategyMode = "blacklist";

export type CreateVideoFileIndexStrategyInput = {
  mode?: VideoFileIndexStrategyMode;
  fileDirId?: number | null;
  fileKeyRegex: string;
  enabled?: boolean;
};

export type UpdateVideoFileIndexStrategyInput = {
  mode?: VideoFileIndexStrategyMode;
  fileDirId?: number | null;
  fileKeyRegex?: string;
  enabled?: boolean;
};

const INDEX_STRATEGY_SORT_KEYS = [
  "id",
  "mode",
  "fileDirId",
  "enabled",
  "createdAt",
  "updatedAt",
] as const;

function buildOrderBy(sortBy?: string, sortOrder?: "asc" | "desc") {
  const col =
    sortBy && INDEX_STRATEGY_SORT_KEYS.includes(sortBy as (typeof INDEX_STRATEGY_SORT_KEYS)[number])
      ? sortBy
      : "id";
  const isAsc = sortOrder === "asc";
  return (
    t: typeof videoFileIndexStrategiesTable,
    op: { asc: (c: unknown) => unknown; desc: (c: unknown) => unknown }
  ) => (isAsc ? [op.asc(t[col as keyof typeof t])] : [op.desc(t[col as keyof typeof t])]);
}

class VideoFileIndexStrategiesService {
  private async ensureFileDirExists(fileDirId: number) {
    const fileDir = await db.query.fileDirsTable.findFirst({
      where: eq(fileDirsTable.id, fileDirId),
      columns: { id: true },
    });
    return !!fileDir;
  }

  async findMany(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    keyword?: string
  ): Promise<PaginatedResult<VideoFileIndexStrategy & { fileDir?: { path: string } }>> {
    const condition = keyword?.trim()
      ? ilike(videoFileIndexStrategiesTable.fileKeyRegex, `%${keyword.trim()}%`)
      : undefined;
    const orderByFn = buildOrderBy(sortBy, sortOrder);
    const listPromise = condition
      ? db.query.videoFileIndexStrategiesTable.findMany({
        where: condition,
        orderBy: orderByFn as Parameters<
          typeof db.query.videoFileIndexStrategiesTable.findMany
        >[0]["orderBy"],
        limit: pageSize,
        offset,
        with: { fileDir: { columns: { path: true } } },
      })
      : db.query.videoFileIndexStrategiesTable.findMany({
        orderBy: orderByFn as Parameters<
          typeof db.query.videoFileIndexStrategiesTable.findMany
        >[0]["orderBy"],
        limit: pageSize,
        offset,
        with: { fileDir: { columns: { path: true } } },
      });
    const totalPromise = condition
      ? db.$count(videoFileIndexStrategiesTable, condition)
      : db.$count(videoFileIndexStrategiesTable);
    const [items, total] = await Promise.all([
      listPromise,
      totalPromise,
    ]);
    return {
      page,
      pageSize,
      total: total ?? 0,
      items: items as (VideoFileIndexStrategy & { fileDir?: { path: string } })[],
    };
  }

  async findById(id: number) {
    return db.query.videoFileIndexStrategiesTable.findFirst({
      where: eq(videoFileIndexStrategiesTable.id, id),
      with: { fileDir: { columns: { path: true } } },
    });
  }

  async create(data: CreateVideoFileIndexStrategyInput) {
    const mode = data.mode ?? "blacklist";
    if (mode !== "blacklist") {
      return { error: "当前仅支持 blacklist 模式" as const };
    }
    const regex = data.fileKeyRegex?.trim();
    if (!regex) {
      return { error: "fileKeyRegex 不能为空" as const };
    }
    const parsedRegex = parseRegexInput(regex);
    if (!parsedRegex) {
      return { error: "fileKeyRegex 不是合法的正则表达式" as const };
    }
    if (data.fileDirId != null) {
      const exists = await this.ensureFileDirExists(data.fileDirId);
      if (!exists) {
        return { error: "fileDirId 对应的目录不存在" as const };
      }
    }

    const values: NewVideoFileIndexStrategy = {
      mode,
      fileDirId: data.fileDirId ?? null,
      fileKeyRegex: parsedRegex.normalizedInput,
      enabled: data.enabled ?? true,
    };
    const [row] = await db.insert(videoFileIndexStrategiesTable).values(values).returning();
    return row ? { item: row } : { error: "创建失败" as const };
  }

  async update(id: number, data: UpdateVideoFileIndexStrategyInput) {
    const existing = await this.findById(id);
    if (!existing) return { error: "策略不存在" as const };

    const mode = data.mode ?? existing.mode;
    if (mode !== "blacklist") {
      return { error: "当前仅支持 blacklist 模式" as const };
    }

    const regex = data.fileKeyRegex !== undefined ? data.fileKeyRegex.trim() : existing.fileKeyRegex;
    if (!regex) {
      return { error: "fileKeyRegex 不能为空" as const };
    }
    const parsedRegex = parseRegexInput(regex);
    if (!parsedRegex) {
      return { error: "fileKeyRegex 不是合法的正则表达式" as const };
    }

    if (data.fileDirId != null) {
      const exists = await this.ensureFileDirExists(data.fileDirId);
      if (!exists) {
        return { error: "fileDirId 对应的目录不存在" as const };
      }
    }

    const updateFields: Partial<NewVideoFileIndexStrategy> = {
      mode,
      fileDirId: data.fileDirId !== undefined ? data.fileDirId : undefined,
      fileKeyRegex: parsedRegex.normalizedInput,
      enabled: data.enabled ?? undefined,
    };
    const filtered = Object.fromEntries(
      Object.entries(updateFields).filter(([, value]) => value !== undefined)
    ) as Partial<NewVideoFileIndexStrategy>;

    const [row] = await db
      .update(videoFileIndexStrategiesTable)
      .set(filtered)
      .where(eq(videoFileIndexStrategiesTable.id, id))
      .returning();
    return row ? { item: row } : { error: "更新失败" as const };
  }

  async delete(id: number) {
    const [row] = await db
      .delete(videoFileIndexStrategiesTable)
      .where(eq(videoFileIndexStrategiesTable.id, id))
      .returning();
    return row ?? null;
  }

  async findMatchingEnabledStrategy(fileDirId: number, fileKey: string) {
    const strategies = await db.query.videoFileIndexStrategiesTable.findMany({
      where: and(
        eq(videoFileIndexStrategiesTable.enabled, true),
        or(eq(videoFileIndexStrategiesTable.fileDirId, fileDirId), isNull(videoFileIndexStrategiesTable.fileDirId))
      ),
    });

    for (const strategy of strategies) {
      if (strategy.mode !== "blacklist") continue;
      const parsedRegex = parseRegexInput(strategy.fileKeyRegex);
      if (!parsedRegex) continue;
      parsedRegex.regex.lastIndex = 0;
      const matched = parsedRegex.regex.test(fileKey);
      if (matched) return strategy;
    }
    return null;
  }

  async applyStrategy(id: number): Promise<{ strategyId: number; removed: number; fileIds: number[] } | { error: string }> {
    const strategy = await this.findById(id);
    if (!strategy) return { error: "策略不存在" };

    const parsedRegex = parseRegexInput(strategy.fileKeyRegex);
    if (!parsedRegex) {
      return { error: "策略正则无效" };
    }

    const candidates =
      strategy.fileDirId == null
        ? await db
          .select({ id: videoFilesTable.id, fileKey: videoFilesTable.fileKey })
          .from(videoFilesTable)
        : await db
          .select({ id: videoFilesTable.id, fileKey: videoFilesTable.fileKey })
          .from(videoFilesTable)
          .where(eq(videoFilesTable.fileDirId, strategy.fileDirId));
    const matchedIds = candidates
      .filter((row) => {
        parsedRegex.regex.lastIndex = 0;
        return parsedRegex.regex.test(row.fileKey);
      })
      .map((row) => row.id);
    if (matchedIds.length === 0) {
      return { strategyId: id, removed: 0, fileIds: [] };
    }

    const deleted = await db
      .delete(videoFilesTable)
      .where(inArray(videoFilesTable.id, matchedIds))
      .returning({ id: videoFilesTable.id });
    videoFilesService.invalidateFolderCaches(strategy.fileDirId ?? undefined);
    return {
      strategyId: id,
      removed: deleted.length,
      fileIds: deleted.map((row) => row.id),
    };
  }
}

export const videoFileIndexStrategiesService = new VideoFileIndexStrategiesService();
