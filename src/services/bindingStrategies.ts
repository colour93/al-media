import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db";
import {
  bindingStrategiesTable,
  type BindingStrategy,
  type NewBindingStrategy,
} from "../entities/BindingStrategy";
import { tagsTable, type Tag, type TagType } from "../entities/Tag";
import { creatorsTable, type Creator } from "../entities/Creator";
import { actorsTable, type Actor } from "../entities/Actor";
import { distributorsTable, type Distributor } from "../entities/Distributor";
import { videoFilesTable } from "../entities/VideoFile";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import { videosService } from "./videos";
import { tagsService } from "./tags";
import { actorsService } from "./actors";
import { creatorsService } from "./creators";
import { distributorsService } from "./distributors";
import { fileDirsService } from "./fileDirs";
import type { PaginatedResult } from "../utils/pagination";
import { parseRegexInput } from "../utils/regex";

export type CreateBindingStrategyInput = {
  type: "folder" | "regex";
  fileDirId?: number | null;
  folderPath?: string | null;
  filenameRegex?: string | null;
  tagIds?: number[];
  creatorIds?: number[];
  actorIds?: number[];
  distributorIds?: number[];
  enabled?: boolean;
};

export type UpdateBindingStrategyInput = {
  type?: "folder" | "regex";
  fileDirId?: number | null;
  folderPath?: string | null;
  filenameRegex?: string | null;
  tagIds?: number[];
  creatorIds?: number[];
  actorIds?: number[];
  distributorIds?: number[];
  enabled?: boolean;
};

export type FolderBindingSummaryItem = {
  fileDirId: number;
  folderPath: string;
  strategyIds: number[];
  primaryStrategyId: number | null;
  strategyCount: number;
  enabled: boolean;
  tagIds: number[];
  creatorIds: number[];
  actorIds: number[];
  distributorIds: number[];
};

export type FolderBindingSnapshot = {
  fileDirId: number;
  items: FolderBindingSummaryItem[];
  tags: Array<Tag & { tagType: TagType | null }>;
  creators: Creator[];
  actors: Actor[];
  distributors: Distributor[];
};

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
  private normalizeFolderPath(folderPath?: string | null): string {
    if (!folderPath) return "";
    return folderPath
      .trim()
      .replace(/[\\]+/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
  }

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

  async listFolderBindingsByFileDir(fileDirId: number): Promise<FolderBindingSnapshot> {
    const rows = await db.query.bindingStrategiesTable.findMany({
      where: and(
        eq(bindingStrategiesTable.type, "folder"),
        eq(bindingStrategiesTable.fileDirId, fileDirId)
      ),
      columns: {
        id: true,
        folderPath: true,
        enabled: true,
        tagIds: true,
        creatorIds: true,
        actorIds: true,
        distributorIds: true,
      },
      orderBy: (t, { asc: ascOrder }) => [ascOrder(t.id)],
    });

    const grouped = new Map<string, {
      strategyIds: number[];
      enabled: boolean;
      tagIds: Set<number>;
      creatorIds: Set<number>;
      actorIds: Set<number>;
      distributorIds: Set<number>;
    }>();

    for (const row of rows) {
      const normalizedPath = this.normalizeFolderPath(row.folderPath);
      if (!normalizedPath) continue;
      if (!grouped.has(normalizedPath)) {
        grouped.set(normalizedPath, {
          strategyIds: [],
          enabled: false,
          tagIds: new Set<number>(),
          creatorIds: new Set<number>(),
          actorIds: new Set<number>(),
          distributorIds: new Set<number>(),
        });
      }
      const bucket = grouped.get(normalizedPath)!;
      bucket.strategyIds.push(row.id);
      bucket.enabled = bucket.enabled || row.enabled;
      for (const id of row.tagIds ?? []) bucket.tagIds.add(id);
      for (const id of row.creatorIds ?? []) bucket.creatorIds.add(id);
      for (const id of row.actorIds ?? []) bucket.actorIds.add(id);
      for (const id of row.distributorIds ?? []) bucket.distributorIds.add(id);
    }

    const items: FolderBindingSummaryItem[] = Array.from(grouped.entries())
      .map(([folderPath, bucket]) => ({
        fileDirId,
        folderPath,
        strategyIds: bucket.strategyIds,
        primaryStrategyId: bucket.strategyIds[0] ?? null,
        strategyCount: bucket.strategyIds.length,
        enabled: bucket.enabled,
        tagIds: Array.from(bucket.tagIds).sort((a, b) => a - b),
        creatorIds: Array.from(bucket.creatorIds).sort((a, b) => a - b),
        actorIds: Array.from(bucket.actorIds).sort((a, b) => a - b),
        distributorIds: Array.from(bucket.distributorIds).sort((a, b) => a - b),
      }))
      .sort((a, b) => a.folderPath.localeCompare(b.folderPath, "zh-CN"));

    const tagIdSet = new Set<number>();
    const creatorIdSet = new Set<number>();
    const actorIdSet = new Set<number>();
    const distributorIdSet = new Set<number>();
    for (const item of items) {
      for (const id of item.tagIds) tagIdSet.add(id);
      for (const id of item.creatorIds) creatorIdSet.add(id);
      for (const id of item.actorIds) actorIdSet.add(id);
      for (const id of item.distributorIds) distributorIdSet.add(id);
    }

    const tagIds = Array.from(tagIdSet);
    const creatorIds = Array.from(creatorIdSet);
    const actorIds = Array.from(actorIdSet);
    const distributorIds = Array.from(distributorIdSet);

    const [tags, creators, actors, distributors] = await Promise.all([
      tagIds.length > 0
        ? db.query.tagsTable.findMany({
          where: inArray(tagsTable.id, tagIds),
          with: { tagType: true },
          orderBy: (t, { asc: ascOrder }) => [ascOrder(t.name), ascOrder(t.id)],
        })
        : Promise.resolve([]),
      creatorIds.length > 0
        ? db.query.creatorsTable.findMany({
          where: inArray(creatorsTable.id, creatorIds),
          orderBy: (t, { asc: ascOrder }) => [ascOrder(t.name), ascOrder(t.id)],
        })
        : Promise.resolve([]),
      actorIds.length > 0
        ? db.query.actorsTable.findMany({
          where: inArray(actorsTable.id, actorIds),
          orderBy: (t, { asc: ascOrder }) => [ascOrder(t.name), ascOrder(t.id)],
        })
        : Promise.resolve([]),
      distributorIds.length > 0
        ? db.query.distributorsTable.findMany({
          where: inArray(distributorsTable.id, distributorIds),
          orderBy: (t, { asc: ascOrder }) => [ascOrder(t.name), ascOrder(t.id)],
        })
        : Promise.resolve([]),
    ]);

    return {
      fileDirId,
      items,
      tags,
      creators,
      actors,
      distributors,
    };
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
      const parsedRegex = parseRegexInput(data.filenameRegex);
      if (!parsedRegex) {
        return { error: "filenameRegex 不是合法的正则表达式" as const };
      }
    } else {
      return { error: "type 必须为 folder 或 regex" as const };
    }

    if (data.fileDirId != null) {
      const fileDir = await fileDirsService.findById(data.fileDirId);
      if (!fileDir) {
        return { error: "fileDirId 对应的 FileDir 不存在" as const };
      }
    }

    const tagIds = [...new Set(data.tagIds ?? [])];
    const creatorIds = [...new Set(data.creatorIds ?? [])];
    const actorIds = [...new Set(data.actorIds ?? [])];
    const distributorIds = [...new Set(data.distributorIds ?? [])];

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
    if (distributorIds.length > 0) {
      const ok = await distributorsService.idsExist(distributorIds);
      if (!ok) return { error: "部分 distributorIds 不存在" as const };
    }

    const insertData: NewBindingStrategy = {
      type: data.type,
      fileDirId: data.fileDirId ?? null,
      folderPath: data.type === "folder" ? data.folderPath!.trim() : null,
      filenameRegex:
        data.type === "regex"
          ? (parseRegexInput(data.filenameRegex!)?.normalizedInput ?? data.filenameRegex!.trim())
          : null,
      tagIds,
      creatorIds,
      actorIds,
      distributorIds,
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
      if (!parseRegexInput(fr)) return { error: "filenameRegex 不是合法的正则表达式" as const };
    }

    if (data.fileDirId !== undefined && data.fileDirId !== null) {
      const fileDir = await fileDirsService.findById(data.fileDirId);
      if (!fileDir) return { error: "fileDirId 对应的 FileDir 不存在" as const };
    }

    const tagIds = data.tagIds !== undefined ? [...new Set(data.tagIds)] : undefined;
    const creatorIds = data.creatorIds !== undefined ? [...new Set(data.creatorIds)] : undefined;
    const actorIds = data.actorIds !== undefined ? [...new Set(data.actorIds)] : undefined;
    const distributorIds =
      data.distributorIds !== undefined ? [...new Set(data.distributorIds)] : undefined;

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
    if (distributorIds && distributorIds.length > 0) {
      const ok = await distributorsService.idsExist(distributorIds);
      if (!ok) return { error: "部分 distributorIds 不存在" as const };
    }

    const updateFields: Partial<NewBindingStrategy> = {
      type: data.type ?? undefined,
      fileDirId: data.fileDirId !== undefined ? data.fileDirId : undefined,
      folderPath: data.folderPath !== undefined ? data.folderPath : undefined,
      filenameRegex:
        data.filenameRegex !== undefined
          ? (data.filenameRegex == null
            ? null
            : parseRegexInput(data.filenameRegex)?.normalizedInput ?? data.filenameRegex)
          : undefined,
      tagIds,
      creatorIds,
      actorIds,
      distributorIds,
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

    const candidateRows = strategy.fileDirId == null
      ? await db
        .select({ uniqueId: videoFilesTable.uniqueId, fileKey: videoFilesTable.fileKey })
        .from(videoFilesTable)
      : await db
        .select({ uniqueId: videoFilesTable.uniqueId, fileKey: videoFilesTable.fileKey })
        .from(videoFilesTable)
        .where(eq(videoFilesTable.fileDirId, strategy.fileDirId));

    let matchingFiles = candidateRows;
    if (strategy.type === "folder") {
      if (!strategy.folderPath) return { error: "folder 策略缺少 folderPath" };
      matchingFiles = candidateRows.filter((row) => row.fileKey.startsWith(strategy.folderPath!));
    } else {
      if (!strategy.filenameRegex) return { error: "regex 策略缺少 filenameRegex" };
      const parsedRegex = parseRegexInput(strategy.filenameRegex);
      if (!parsedRegex) return { error: "regex 策略正则无效" };
      matchingFiles = candidateRows.filter((row) => {
        parsedRegex.regex.lastIndex = 0;
        return parsedRegex.regex.test(row.fileKey);
      });
    }

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
    const distributorIds = strategy.distributorIds ?? [];

    if (
      tagIds.length === 0 &&
      creatorIds.length === 0 &&
      actorIds.length === 0 &&
      distributorIds.length === 0
    ) {
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
    if (distributorIds.length > 0) {
      const { added } = await videosService.batchAddDistributors(videoIds, distributorIds);
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
    const strategies = await db.query.bindingStrategiesTable.findMany({
      where:
        videoFile.fileDirId == null
          ? and(eq(bindingStrategiesTable.enabled, true), isNull(bindingStrategiesTable.fileDirId))
          : and(
            eq(bindingStrategiesTable.enabled, true),
            or(
              eq(bindingStrategiesTable.fileDirId, videoFile.fileDirId),
              isNull(bindingStrategiesTable.fileDirId)
            )
          ),
    });

    for (const s of strategies) {
      let matched = false;
      if (s.type === "folder" && s.folderPath) {
        matched = videoFile.fileKey.startsWith(s.folderPath);
      } else if (s.type === "regex" && s.filenameRegex) {
        const parsedRegex = parseRegexInput(s.filenameRegex);
        if (!parsedRegex) continue;
        parsedRegex.regex.lastIndex = 0;
        matched = parsedRegex.regex.test(videoFile.fileKey);
      }
      if (!matched) continue;

      const tagIds = s.tagIds ?? [];
      const creatorIds = s.creatorIds ?? [];
      const actorIds = s.actorIds ?? [];
      const distributorIds = s.distributorIds ?? [];
      if (tagIds.length > 0) await videosService.batchAddTags([videoId], tagIds);
      if (creatorIds.length > 0) await videosService.batchAddCreators([videoId], creatorIds);
      if (actorIds.length > 0) await videosService.batchAddActors([videoId], actorIds);
      if (distributorIds.length > 0) {
        await videosService.batchAddDistributors([videoId], distributorIds);
      }
    }
  }
}

export const bindingStrategiesService = new BindingStrategiesService();
