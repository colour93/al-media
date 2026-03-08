import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../db";
import { videoFilesTable } from "../entities/VideoFile";
import { fileDirsTable } from "../entities/FileDir";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import type { PaginatedResult } from "../utils/pagination";
import { evaluateVideoWebCompatibility } from "../utils/videoWebCompatibility";

const videoFileWithRelations = {
  fileDir: { columns: { id: true, path: true } },
  sourceVideoFile: { columns: { id: true, fileKey: true } },
  videoFileUnique: {
    with: {
      videoUniqueContents: {
        with: { video: true },
      },
    },
  },
} as const;

const VIDEO_FILE_SORT_KEYS = ["id", "fileKey", "uniqueId", "fileSize", "videoDuration", "createdAt", "updatedAt"] as const;

export type VideoFileWebCompatibilityFilter = "all" | "compatible" | "incompatible";
export type VideoFileHasVideoFilter = "all" | "bound" | "unbound";
export type VideoFileListFilters = {
  webCompatibility?: VideoFileWebCompatibilityFilter;
  hasVideo?: VideoFileHasVideoFilter;
  fileDirId?: number;
};

function buildVideoFileOrderBy(sortBy?: string, sortOrder?: "asc" | "desc") {
  const col = sortBy && VIDEO_FILE_SORT_KEYS.includes(sortBy as (typeof VIDEO_FILE_SORT_KEYS)[number])
    ? sortBy
    : "id";
  return { col, isAsc: sortOrder === "asc" };
}

function toVideoFileResponse(
  item: {
    videoFileUnique?: { videoUniqueContents?: Array<{ video: unknown }> };
    fileDir?: { path?: string } | null;
    sourceVideoFile?: { id: number; fileKey: string } | null;
  } & Record<string, unknown> | null | undefined
) {
  if (!item) return null;
  const { videoFileUnique, fileDir, ...videoFile } = item;
  const video = videoFileUnique?.videoUniqueContents?.[0]?.video ?? null;
  const videoObj = video as { thumbnailKey?: string | null } | null;
  const thumbnailKey =
    videoObj?.thumbnailKey ?? ((videoFile.uniqueId as string) ? `${(videoFile.uniqueId as string)}.jpg` : null);
  const compatibility = evaluateVideoWebCompatibility({
    fileKey: typeof videoFile.fileKey === "string" ? videoFile.fileKey : null,
    videoCodec: typeof videoFile.videoCodec === "string" ? videoFile.videoCodec : null,
    audioCodec: typeof videoFile.audioCodec === "string" ? videoFile.audioCodec : null,
    mp4MoovBeforeMdat:
      typeof videoFile.mp4MoovBeforeMdat === "boolean" ? videoFile.mp4MoovBeforeMdat : null,
  });
  return { ...videoFile, ...compatibility, video, fileDir, thumbnailKey };
}

function buildVideoFileWebCompatibleSql() {
  const normalizedFileKeySql = sql<string>`replace(${videoFilesTable.fileKey}, chr(92), '/')`;
  const containerSql = sql<string>`lower(coalesce(substring(${normalizedFileKeySql} from '\\.([^.\\/]+)$'), ''))`;
  const videoCodecRawSql = sql<string>`lower(trim(coalesce(${videoFilesTable.videoCodec}, '')))`;
  const videoCodecSql = sql<string>`case
    when ${videoCodecRawSql} = '' then ''
    when ${videoCodecRawSql} = 'libx264' then 'h264'
    when ${videoCodecRawSql} like 'avc%' then 'avc'
    when ${videoCodecRawSql} in ('hevc', 'h265') then 'h265'
    else ${videoCodecRawSql}
  end`;
  const audioCodecSql = sql<string>`lower(trim(coalesce(${videoFilesTable.audioCodec}, '')))`;
  const hasAnySignalSql = sql<boolean>`(
    ${containerSql} <> '' or
    ${videoCodecRawSql} <> '' or
    ${audioCodecSql} <> '' or
    ${videoFilesTable.mp4MoovBeforeMdat} is not null
  )`;
  return sql<boolean>`(
    (not ${hasAnySignalSql})
    or (
      ${containerSql} in ('mp4', 'm4v', 'webm')
      and ${videoCodecSql} in ('h264', 'avc', 'avc1', 'vp8', 'vp9', 'av1')
      and (${audioCodecSql} = '' or ${audioCodecSql} in ('aac', 'mp3', 'opus', 'vorbis'))
      and (${containerSql} <> 'mp4' or ${videoFilesTable.mp4MoovBeforeMdat} = true)
    )
  )`;
}

function buildVideoFileWebCompatibilityWhere(filter: VideoFileWebCompatibilityFilter) {
  if (filter === "all") return undefined;
  const compatibleSql = buildVideoFileWebCompatibleSql();
  if (filter === "compatible") {
    return compatibleSql;
  }
  return sql<boolean>`not (${compatibleSql})`;
}

function buildVideoFileFilterConditions(filters?: VideoFileListFilters) {
  const webCompatibility = filters?.webCompatibility ?? "all";
  const hasVideo = filters?.hasVideo ?? "all";
  const fileDirId = filters?.fileDirId;
  const conditions = [];

  if (Number.isInteger(fileDirId) && (fileDirId as number) > 0) {
    conditions.push(eq(videoFilesTable.fileDirId, fileDirId as number));
  }

  const compatibilityCondition = buildVideoFileWebCompatibilityWhere(webCompatibility);
  if (compatibilityCondition) {
    conditions.push(compatibilityCondition);
  }

  if (hasVideo !== "all") {
    const hasVideoCondition = sql<boolean>`exists (
      select 1
      from ${videoUniqueContentsTable}
      where ${videoUniqueContentsTable.uniqueId} = ${videoFilesTable.uniqueId}
    )`;
    conditions.push(hasVideo === "bound" ? hasVideoCondition : sql<boolean>`not (${hasVideoCondition})`);
  }

  return conditions;
}

type FolderChildrenCacheValue = {
  expiresAt: number;
  value: { items: Array<{ fileDirId: number; path: string; name: string }>; nextCursor: string | null };
};

type FolderPrefixesCacheValue = {
  expiresAt: number;
  value: {
    items: string[];
    total: number;
    truncated: boolean;
  };
};

export type VideoFileDuplicateGroup = {
  uniqueId: string;
  fileCount: number;
  files: unknown[];
};

const FOLDER_CHILDREN_CACHE_TTL_MS = 15_000;
const FOLDER_PREFIXES_CACHE_TTL_MS = 30_000;

class VideoFilesService {
  private folderChildrenCache = new Map<string, FolderChildrenCacheValue>();
  private folderPrefixesCache = new Map<string, FolderPrefixesCacheValue>();

  private clearCacheByFileDirId<T>(cache: Map<string, T>, fileDirId?: number) {
    if (!Number.isInteger(fileDirId) || (fileDirId as number) < 1) {
      cache.clear();
      return;
    }
    const keyPrefix = `${fileDirId}|`;
    for (const key of cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        cache.delete(key);
      }
    }
  }

  invalidateFolderCaches(fileDirId?: number) {
    this.clearCacheByFileDirId(this.folderChildrenCache, fileDirId);
    this.clearCacheByFileDirId(this.folderPrefixesCache, fileDirId);
  }

  private normalizeFolderPath(folderPath?: string): string {
    if (!folderPath) return "";
    return folderPath.trim().replace(/^[\\/]+/, "").replace(/[\\/]+$/, "");
  }

  async findManyPaginated(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    options?: VideoFileListFilters
  ): Promise<PaginatedResult<unknown>> {
    const filterConditions = buildVideoFileFilterConditions(options);
    const where = filterConditions.length > 0 ? and(...filterConditions) : undefined;
    const { col, isAsc } = buildVideoFileOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.videoFilesTable.findMany({
        where,
        orderBy: (t, op) => {
          const sort = isAsc ? op.asc : op.desc;
          switch (col) {
            case "fileKey":
              return [sort(t.fileKey)];
            case "uniqueId":
              return [sort(t.uniqueId)];
            case "fileSize":
              return [sort(t.fileSize)];
            case "videoDuration":
              return [sort(t.videoDuration)];
            case "createdAt":
              return [sort(t.createdAt)];
            case "updatedAt":
              return [sort(t.updatedAt)];
            default:
              return [sort(t.id)];
          }
        },
        limit: pageSize,
        offset,
        with: videoFileWithRelations,
      }),
      where ? db.$count(videoFilesTable, where) : db.$count(videoFilesTable),
    ]);
    return { page, pageSize, total: total ?? 0, items: items.map((it) => toVideoFileResponse(it)) };
  }

  async searchPaginated(
    keyword: string,
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    options?: VideoFileListFilters
  ): Promise<PaginatedResult<unknown>> {
    const dirsWithPath = await db
      .select({ id: fileDirsTable.id })
      .from(fileDirsTable)
      .where(ilike(fileDirsTable.path, `%${keyword}%`));
    const dirIds = dirsWithPath.map((d) => d.id);
    const keywordTrimmed = keyword.trim();
    const numericKeyword = keywordTrimmed.startsWith("#") ? keywordTrimmed.slice(1) : keywordTrimmed;
    const conditions = [
      ilike(videoFilesTable.fileKey, `%${keyword}%`),
      ilike(videoFilesTable.uniqueId, `%${keyword}%`),
    ];
    if (/^\d+$/.test(numericKeyword)) {
      const keywordId = Number(numericKeyword);
      if (Number.isSafeInteger(keywordId) && keywordId > 0) {
        conditions.push(eq(videoFilesTable.id, keywordId));
      }
    }
    if (dirIds.length > 0) {
      conditions.push(inArray(videoFilesTable.fileDirId, dirIds));
    }
    const keywordCondition = or(...conditions) ?? sql<boolean>`true`;
    const filterConditions = buildVideoFileFilterConditions(options);
    const condition =
      filterConditions.length > 0 ? and(keywordCondition, ...filterConditions) : keywordCondition;
    const { col, isAsc } = buildVideoFileOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.videoFilesTable.findMany({
        where: condition,
        orderBy: (t, op) => {
          const sort = isAsc ? op.asc : op.desc;
          switch (col) {
            case "fileKey":
              return [sort(t.fileKey)];
            case "uniqueId":
              return [sort(t.uniqueId)];
            case "fileSize":
              return [sort(t.fileSize)];
            case "videoDuration":
              return [sort(t.videoDuration)];
            case "createdAt":
              return [sort(t.createdAt)];
            case "updatedAt":
              return [sort(t.updatedAt)];
            default:
              return [sort(t.id)];
          }
        },
        limit: pageSize,
        offset,
        with: videoFileWithRelations,
      }),
      db.$count(videoFilesTable, condition),
    ]);
    return { page, pageSize, total: total ?? 0, items: items.map((it) => toVideoFileResponse(it)) };
  }

  async findById(id: number) {
    const item = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.id, id),
      with: videoFileWithRelations,
    });
    return toVideoFileResponse(item);
  }

  async findByIdRaw(id: number) {
    return db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.id, id),
    });
  }

  private async unlinkFileSafe(path: string): Promise<{ removedFromDisk: boolean; diskMissing: boolean }> {
    try {
      await unlink(path);
      return { removedFromDisk: true, diskMissing: false };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        return { removedFromDisk: false, diskMissing: true };
      }
      throw error;
    }
  }

  async removeFileById(
    id: number
  ): Promise<
    | {
      item: { id: number; fileKey: string; uniqueId: string };
      removedFromDisk: boolean;
      diskMissing: boolean;
    }
    | { error: "视频文件不存在" }
  > {
    const target = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.id, id),
      columns: {
        id: true,
        fileDirId: true,
        fileKey: true,
        uniqueId: true,
      },
    });
    if (!target) {
      return { error: "视频文件不存在" };
    }

    let removedFromDisk = false;
    let diskMissing = true;
    const fileDirPath =
      target.fileDirId == null
        ? null
        : (
          await db.query.fileDirsTable.findFirst({
            where: eq(fileDirsTable.id, target.fileDirId),
            columns: { path: true },
          })
        )?.path ?? null;
    if (fileDirPath) {
      const unlinkResult = await this.unlinkFileSafe(join(fileDirPath, target.fileKey));
      removedFromDisk = unlinkResult.removedFromDisk;
      diskMissing = unlinkResult.diskMissing;
    }

    const deletedRows = await db
      .delete(videoFilesTable)
      .where(eq(videoFilesTable.id, id))
      .returning({
        id: videoFilesTable.id,
        fileKey: videoFilesTable.fileKey,
        uniqueId: videoFilesTable.uniqueId,
      });
    const deleted = deletedRows[0] ?? {
      id: target.id,
      fileKey: target.fileKey,
      uniqueId: target.uniqueId,
    };
    this.invalidateFolderCaches(target.fileDirId ?? undefined);
    return {
      item: deleted,
      removedFromDisk,
      diskMissing,
    };
  }

  async removeReencodeSourceByOutputId(
    outputVideoFileId: number
  ): Promise<
    | {
      outputVideoFileId: number;
      sourceVideoFileId: number;
      sourceFileKey: string;
      removedFromDisk: boolean;
      diskMissing: boolean;
    }
    | {
      error: "输出视频文件不存在" | "该文件没有可删除的转码源文件" | "转码源文件不存在";
    }
  > {
    const output = await db.query.videoFilesTable.findFirst({
      where: eq(videoFilesTable.id, outputVideoFileId),
      columns: {
        id: true,
        sourceVideoFileId: true,
      },
    });
    if (!output) {
      return { error: "输出视频文件不存在" };
    }
    if (!output.sourceVideoFileId) {
      return { error: "该文件没有可删除的转码源文件" };
    }

    const deleted = await this.removeFileById(output.sourceVideoFileId);
    if ("error" in deleted) {
      return { error: "转码源文件不存在" };
    }

    return {
      outputVideoFileId: output.id,
      sourceVideoFileId: deleted.item.id,
      sourceFileKey: deleted.item.fileKey,
      removedFromDisk: deleted.removedFromDisk,
      diskMissing: deleted.diskMissing,
    };
  }

  async findDuplicateGroupsPaginated(
    page: number,
    pageSize: number,
    offset: number
  ): Promise<PaginatedResult<VideoFileDuplicateGroup>> {
    const [groupRows, totalRows] = await Promise.all([
      db
        .select({
          uniqueId: videoFilesTable.uniqueId,
          fileCount: sql<number>`count(*)`,
        })
        .from(videoFilesTable)
        .groupBy(videoFilesTable.uniqueId)
        .having(sql`count(*) > 1`)
        .orderBy(desc(sql`count(*)`), asc(videoFilesTable.uniqueId))
        .limit(pageSize)
        .offset(offset),
      db.execute<{ total: number }>(sql`
        select count(*)::int as total
        from (
          select ${videoFilesTable.uniqueId}
          from ${videoFilesTable}
          group by ${videoFilesTable.uniqueId}
          having count(*) > 1
        ) as duplicate_groups
      `),
    ]);

    const total = Number(totalRows.rows[0]?.total ?? 0);
    if (groupRows.length === 0) {
      return { page, pageSize, total, items: [] };
    }

    const uniqueIds = groupRows.map((row) => row.uniqueId);
    const files = await db.query.videoFilesTable.findMany({
      where: inArray(videoFilesTable.uniqueId, uniqueIds),
      with: videoFileWithRelations,
      orderBy: (t, { asc }) => [asc(t.uniqueId), asc(t.id)],
    });

    const filesByUniqueId = new Map<string, unknown[]>();
    for (const file of files) {
      const response = toVideoFileResponse(file);
      if (!response) continue;
      const uniqueIdValue = (response as Record<string, unknown>).uniqueId;
      if (typeof uniqueIdValue !== "string" || !uniqueIdValue) continue;
      const key = uniqueIdValue;
      const bucket = filesByUniqueId.get(key) ?? [];
      bucket.push(response);
      filesByUniqueId.set(key, bucket);
    }

    const items = groupRows.map((row) => ({
      uniqueId: row.uniqueId,
      fileCount: Number(row.fileCount),
      files: filesByUniqueId.get(row.uniqueId) ?? [],
    }));

    return { page, pageSize, total, items };
  }

  async listFolderChildren(
    fileDirId: number,
    folderPath?: string,
    cursor?: string,
    pageSize = 50
  ): Promise<{ items: Array<{ fileDirId: number; path: string; name: string }>; nextCursor: string | null }> {
    const normalizedPath = this.normalizeFolderPath(folderPath);
    const cacheKey = `${fileDirId}|${normalizedPath}|${cursor ?? ""}|${pageSize}`;
    const now = Date.now();
    const cached = this.folderChildrenCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const prefix = normalizedPath ? `${normalizedPath}/` : "";
    const prefixLike = `${prefix}%`;
    const startPos = prefix.length + 1;
    const rowsResult = await db.execute<{ name: string }>(sql`
      with folder_candidates as (
        select split_part(
          substring(replace("fileKey", chr(92), '/') from cast(${startPos} as integer)),
          '/',
          1
        ) as name
        from video_files
        where "fileDirId" = ${fileDirId}
          and replace("fileKey", chr(92), '/') like ${prefixLike}
          and position('/' in substring(replace("fileKey", chr(92), '/') from cast(${startPos} as integer))) > 0
      )
      select distinct name
      from folder_candidates
      where name <> ''
      ${cursor ? sql`and name > ${cursor}` : sql``}
      order by name
      limit ${pageSize + 1}
    `);
    const rows = rowsResult.rows;

    const hasMore = rows.length > pageSize;
    const sliced = hasMore ? rows.slice(0, pageSize) : rows;
    const items = sliced
      .map((row) => row.name?.trim())
      .filter((name): name is string => !!name)
      .map((name) => ({
        fileDirId,
        name,
        path: normalizedPath ? `${normalizedPath}/${name}` : name,
      }));
    const nextCursor = hasMore ? items[items.length - 1]?.name ?? null : null;
    const value = { items, nextCursor };
    this.folderChildrenCache.set(cacheKey, {
      expiresAt: now + FOLDER_CHILDREN_CACHE_TTL_MS,
      value,
    });
    return value;
  }

  async listFolderPrefixes(
    fileDirId: number,
    limit = 5000
  ): Promise<{ items: string[]; total: number; truncated: boolean }> {
    const safeLimit = Math.max(1, Math.min(20000, Math.trunc(limit)));
    const cacheKey = `${fileDirId}|${safeLimit}`;
    const now = Date.now();
    const cached = this.folderPrefixesCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const rowsResult = await db.execute<{ path: string }>(sql`
      with normalized as (
        select regexp_split_to_array(replace("fileKey", chr(92), '/'), '/') as parts
        from video_files
        where "fileDirId" = ${fileDirId}
          and position('/' in replace("fileKey", chr(92), '/')) > 0
      ),
      prefixes as (
        select array_to_string(parts[1:idx], '/') as path
        from normalized, generate_subscripts(parts, 1) as idx
        where idx < array_length(parts, 1)
      )
      select distinct path
      from prefixes
      where path <> ''
      order by path
      limit ${safeLimit + 1}
    `);

    const allRows = rowsResult.rows
      .map((row) => row.path?.trim())
      .filter((path): path is string => !!path);
    const total = allRows.length;
    const truncated = total > safeLimit;
    const items = truncated ? allRows.slice(0, safeLimit) : allRows;
    const value = { items, total, truncated };
    this.folderPrefixesCache.set(cacheKey, {
      expiresAt: now + FOLDER_PREFIXES_CACHE_TTL_MS,
      value,
    });
    return value;
  }

  async listFolderFiles(
    fileDirId: number,
    folderPath?: string,
    cursor?: string,
    pageSize = 50
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const normalizedPath = this.normalizeFolderPath(folderPath);
    const prefix = normalizedPath ? `${normalizedPath}/` : "";
    const prefixLike = `${prefix}%`;
    const startPos = prefix.length + 1;
    const normalizedFileKeySql = sql<string>`replace(${videoFilesTable.fileKey}, chr(92), '/')`;

    const rows = await db.query.videoFilesTable.findMany({
      where: sql<boolean>`
        ${videoFilesTable.fileDirId} = ${fileDirId}
        and ${normalizedFileKeySql} like ${prefixLike}
        and position('/' in substring(${normalizedFileKeySql} from cast(${startPos} as integer))) = 0
        ${cursor ? sql`and ${videoFilesTable.fileKey} > ${cursor}` : sql``}
      `,
      orderBy: [asc(videoFilesTable.fileKey)],
      limit: pageSize + 1,
      with: videoFileWithRelations,
    });

    const hasMore = rows.length > pageSize;
    const sliced = hasMore ? rows.slice(0, pageSize) : rows;
    const items = sliced.map((it) => toVideoFileResponse(it));
    const nextCursor = hasMore ? (sliced[sliced.length - 1]?.fileKey ?? null) : null;
    return { items, nextCursor };
  }
}

export const videoFilesService = new VideoFilesService();
