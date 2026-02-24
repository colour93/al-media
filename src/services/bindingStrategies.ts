import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "../db";
import {
  bindingStrategiesTable,
  type BindingStrategy,
  type NewBindingStrategy,
} from "../entities/BindingStrategy";
import { videoFilesTable } from "../entities/VideoFile";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { videosService } from "./videos";
import { tagsService } from "./tags";
import { actorsService } from "./actors";
import { creatorsService } from "./creators";
import { fileDirsService } from "./fileDirs";
import type { PaginatedResult } from "../utils/pagination";

export type CreateBindingStrategyInput = {
  type: "folder" | "regex";
  fileDirId: number;
  folderPath?: string | null;
  filenameRegex?: string | null;
  tagIds?: number[];
  creatorIds?: number[];
  actorIds?: number[];
  enabled?: boolean;
};

export type UpdateBindingStrategyInput = {
  type?: "folder" | "regex";
  fileDirId?: number;
  folderPath?: string | null;
  filenameRegex?: string | null;
  tagIds?: number[];
  creatorIds?: number[];
  actorIds?: number[];
  enabled?: boolean;
};

function validateRegex(regexStr: string): boolean {
  try {
    new RegExp(regexStr);
    return true;
  } catch {
    return false;
  }
}

const STRATEGY_SORT_KEYS = ["id", "type", "fileDirId", "enabled", "createdAt", "updatedAt"] as const;

function buildOrderBy(sortBy?: string, sortOrder?: "asc" | "desc") {
  const col =
    sortBy && STRATEGY_SORT_KEYS.includes(sortBy as (typeof STRATEGY_SORT_KEYS)[number])
      ? sortBy
      : "id";
  const isAsc = sortOrder === "asc";
  return (
    t: typeof bindingStrategiesTable,
    op: { asc: (c: unknown) => unknown; desc: (c: unknown) => unknown }
  ) => (isAsc ? [op.asc(t[col as keyof typeof t])] : [op.desc(t[col as keyof typeof t])]);
}

class BindingStrategiesService {
  async findMany(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<BindingStrategy & { fileDir?: { path: string } }>> {
    const orderByFn = buildOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.bindingStrategiesTable.findMany({
        orderBy: orderByFn as Parameters<
          typeof db.query.bindingStrategiesTable.findMany
        >[0]["orderBy"],
        limit: pageSize,
        offset,
        with: { fileDir: { columns: { path: true } } },
      }),
      db.$count(bindingStrategiesTable),
    ]);
    return {
      page,
      pageSize,
      total: total ?? 0,
      items: items as (BindingStrategy & { fileDir?: { path: string } })[],
    };
  }

  async findById(id: number) {
    return db.query.bindingStrategiesTable.findFirst({
      where: eq(bindingStrategiesTable.id, id),
      with: { fileDir: true },
    });
  }

  async create(data: CreateBindingStrategyInput) {
    if (data.type === "folder") {
      if (!data.folderPath?.trim()) {
        return { error: "folder 类型策略需指定 folderPath" as const };
      }
    } else if (data.type === "regex") {
      if (!data.filenameRegex?.trim()) {
        return { error: "regex 类型策略需指定 filenameRegex" as const };
      }
      if (!validateRegex(data.filenameRegex)) {
        return { error: "filenameRegex 不是合法的正则表达式" as const };
      }
    } else {
      return { error: "type 必须为 folder 或 regex" as const };
    }

    const fileDir = await fileDirsService.findById(data.fileDirId);
    if (!fileDir) {
      return { error: "fileDirId 对应的 FileDir 不存在" as const };
    }

    const tagIds = [...new Set(data.tagIds ?? [])];
    const creatorIds = [...new Set(data.creatorIds ?? [])];
    const actorIds = [...new Set(data.actorIds ?? [])];

    if (tagIds.length > 0) {
      const ok = await tagsService.idsExist(tagIds);
      if (!ok) return { error: "部分 tagIds 不存在" as const };
    }
    if (creatorIds.length > 0) {
      const ok = await creatorsService.idsExist(creatorIds);
      if (!ok) return { error: "部分 creatorIds 不存在" as const };
    }
    if (actorIds.length > 0) {
      const ok = await actorsService.idsExist(actorIds);
      if (!ok) return { error: "部分 actorIds 不存在" as const };
    }

    const insertData: NewBindingStrategy = {
      type: data.type,
      fileDirId: data.fileDirId,
      folderPath: data.type === "folder" ? data.folderPath!.trim() : null,
      filenameRegex: data.type === "regex" ? data.filenameRegex!.trim() : null,
      tagIds,
      creatorIds,
      actorIds,
      enabled: data.enabled ?? true,
    };

    const [row] = await db.insert(bindingStrategiesTable).values(insertData).returning();
    return row ? { item: row } : { error: "创建失败" as const };
  }

  async update(id: number, data: UpdateBindingStrategyInput) {
    const existing = await this.findById(id);
    if (!existing) return { error: "策略不存在" as const };

    const type = data.type ?? existing.type;
    if (type === "folder" && (data.folderPath !== undefined || !existing.folderPath)) {
      const fp = data.folderPath !== undefined ? data.folderPath : existing.folderPath;
      if (!fp?.trim()) return { error: "folder 类型策略需指定 folderPath" as const };
    }
    if (type === "regex" && (data.filenameRegex !== undefined || !existing.filenameRegex)) {
      const fr = data.filenameRegex !== undefined ? data.filenameRegex : existing.filenameRegex;
      if (!fr?.trim()) return { error: "regex 类型策略需指定 filenameRegex" as const };
      if (!validateRegex(fr)) return { error: "filenameRegex 不是合法的正则表达式" as const };
    }

    if (data.fileDirId !== undefined) {
      const fileDir = await fileDirsService.findById(data.fileDirId);
      if (!fileDir) return { error: "fileDirId 对应的 FileDir 不存在" as const };
    }

    const tagIds = data.tagIds !== undefined ? [...new Set(data.tagIds)] : undefined;
    const creatorIds = data.creatorIds !== undefined ? [...new Set(data.creatorIds)] : undefined;
    const actorIds = data.actorIds !== undefined ? [...new Set(data.actorIds)] : undefined;

    if (tagIds && tagIds.length > 0) {
      const ok = await tagsService.idsExist(tagIds);
      if (!ok) return { error: "部分 tagIds 不存在" as const };
    }
    if (creatorIds && creatorIds.length > 0) {
      const ok = await creatorsService.idsExist(creatorIds);
      if (!ok) return { error: "部分 creatorIds 不存在" as const };
    }
    if (actorIds && actorIds.length > 0) {
      const ok = await actorsService.idsExist(actorIds);
      if (!ok) return { error: "部分 actorIds 不存在" as const };
    }

    const updateFields: Partial<NewBindingStrategy> = {
      type: data.type ?? undefined,
      fileDirId: data.fileDirId ?? undefined,
      folderPath: data.folderPath !== undefined ? data.folderPath : undefined,
      filenameRegex: data.filenameRegex !== undefined ? data.filenameRegex : undefined,
      tagIds: data.tagIds !== undefined ? data.tagIds : undefined,
      creatorIds: data.creatorIds !== undefined ? data.creatorIds : undefined,
      actorIds: data.actorIds !== undefined ? data.actorIds : undefined,
      enabled: data.enabled ?? undefined,
    };
    const filtered = Object.fromEntries(
      Object.entries(updateFields).filter(([, v]) => v !== undefined)
    ) as Partial<NewBindingStrategy>;

    const [row] = await db
      .update(bindingStrategiesTable)
      .set(filtered)
      .where(eq(bindingStrategiesTable.id, id))
      .returning();
    return row ? { item: row } : { error: "更新失败" as const };
  }

  async delete(id: number) {
    const [row] = await db
      .delete(bindingStrategiesTable)
      .where(eq(bindingStrategiesTable.id, id))
      .returning();
    return row ?? null;
  }

  async applyStrategy(id: number): Promise<{ applied: number; videoIds: number[] } | { error: string }> {
    const strategy = await this.findById(id);
    if (!strategy) return { error: "策略不存在" };
    if (!strategy.enabled) return { error: "策略未启用" };

    const conditions = [eq(videoFilesTable.fileDirId, strategy.fileDirId)];
    if (strategy.type === "folder") {
      if (!strategy.folderPath) return { error: "folder 策略缺少 folderPath" };
      conditions.push(like(videoFilesTable.fileKey, strategy.folderPath + "%"));
    } else {
      if (!strategy.filenameRegex) return { error: "regex 策略缺少 filenameRegex" };
      conditions.push(sql`${videoFilesTable.fileKey} ~ ${strategy.filenameRegex}`);
    }

    const matchingFiles = await db
      .select({ uniqueId: videoFilesTable.uniqueId })
      .from(videoFilesTable)
      .where(and(...conditions));

    const uniqueIds = [...new Set(matchingFiles.map((f) => f.uniqueId))];
    if (uniqueIds.length === 0) {
      return { applied: 0, videoIds: [] };
    }

    const contents = await db
      .select({ videoId: videoUniqueContentsTable.videoId })
      .from(videoUniqueContentsTable)
      .where(inArray(videoUniqueContentsTable.uniqueId, uniqueIds));

    const videoIds = [...new Set(contents.map((c) => c.videoId))];
    if (videoIds.length === 0) return { applied: 0, videoIds: [] };

    const tagIds = strategy.tagIds ?? [];
    const creatorIds = strategy.creatorIds ?? [];
    const actorIds = strategy.actorIds ?? [];

    if (tagIds.length === 0 && creatorIds.length === 0 && actorIds.length === 0) {
      return { applied: videoIds.length, videoIds };
    }

    let totalAdded = 0;
    if (tagIds.length > 0) {
      const { added } = await videosService.batchAddTags(videoIds, tagIds);
      totalAdded += added;
    }
    if (creatorIds.length > 0) {
      const { added } = await videosService.batchAddCreators(videoIds, creatorIds);
      totalAdded += added;
    }
    if (actorIds.length > 0) {
      const { added } = await videosService.batchAddActors(videoIds, actorIds);
      totalAdded += added;
    }

    return { applied: totalAdded, videoIds };
  }

  async applyAllStrategies(): Promise<{ totalApplied: number; results: Array<{ id: number; applied: number; videoIds: number[] }> }> {
    const strategies = await db.query.bindingStrategiesTable.findMany({
      where: eq(bindingStrategiesTable.enabled, true),
      columns: { id: true },
    });

    const results: Array<{ id: number; applied: number; videoIds: number[] }> = [];
    let totalApplied = 0;

    for (const s of strategies) {
      const r = await this.applyStrategy(s.id);
      if ("error" in r) continue;
      results.push({ id: s.id, applied: r.applied, videoIds: r.videoIds });
      totalApplied += r.applied;
    }

    return { totalApplied, results };
  }

  /**
   * 对指定 VideoFile 关联的 Video 应用所有匹配的 enabled 策略。
   * 供 insertVideoFromVideoFile 在创建 Video 成功后调用。
   */
  async applyMatchingStrategiesForVideoFile(
    videoFile: { fileDirId: number | null | undefined; fileKey: string },
    videoId: number
  ): Promise<void> {
    if (videoFile.fileDirId == null) return;

    const strategies = await db.query.bindingStrategiesTable.findMany({
      where: and(
        eq(bindingStrategiesTable.fileDirId, videoFile.fileDirId),
        eq(bindingStrategiesTable.enabled, true)
      ),
    });

    for (const s of strategies) {
      let matched = false;
      if (s.type === "folder" && s.folderPath) {
        matched = videoFile.fileKey.startsWith(s.folderPath);
      } else if (s.type === "regex" && s.filenameRegex) {
        try {
          matched = new RegExp(s.filenameRegex).test(videoFile.fileKey);
        } catch {
          continue;
        }
      }
      if (!matched) continue;

      const tagIds = s.tagIds ?? [];
      const creatorIds = s.creatorIds ?? [];
      const actorIds = s.actorIds ?? [];
      if (tagIds.length > 0) await videosService.batchAddTags([videoId], tagIds);
      if (creatorIds.length > 0) await videosService.batchAddCreators([videoId], creatorIds);
      if (actorIds.length > 0) await videosService.batchAddActors([videoId], actorIds);
    }
  }
}

export const bindingStrategiesService = new BindingStrategiesService();
