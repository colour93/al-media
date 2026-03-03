import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { videoFilesTable } from "../entities/VideoFile";
import { fileDirsTable } from "../entities/FileDir";
import { videoUniqueContentsTable } from "../entities/VideoUniqueContent";
import type { PaginatedResult } from "../utils/pagination";
import { evaluateVideoWebCompatibility } from "../utils/videoWebCompatibility";

const videoFileWithRelations = {
  fileDir: { columns: { id: true, path: true } },
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
  const isAsc = sortOrder === "asc";
  return (t: typeof videoFilesTable, op: { asc: (c: unknown) => unknown; desc: (c: unknown) => unknown }) =>
    isAsc ? [op.asc(t[col as keyof typeof t])] : [op.desc(t[col as keyof typeof t])];
}

function toVideoFileResponse(
  item: {
    videoFileUnique?: { videoUniqueContents?: Array<{ video: unknown }> };
    fileDir?: { path?: string };
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

const FOLDER_CHILDREN_CACHE_TTL_MS = 15_000;

class VideoFilesService {
  private folderChildrenCache = new Map<string, FolderChildrenCacheValue>();

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
    const orderByFn = buildVideoFileOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.videoFilesTable.findMany({
        where,
        orderBy: orderByFn as Parameters<typeof db.query.videoFilesTable.findMany>[0]["orderBy"],
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
    const orderByFn = buildVideoFileOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.videoFilesTable.findMany({
        where: condition,
        orderBy: orderByFn as Parameters<typeof db.query.videoFilesTable.findMany>[0]["orderBy"],
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
