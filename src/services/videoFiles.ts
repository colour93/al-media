import { eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { videoFilesTable } from "../entities/VideoFile";
import { fileDirsTable } from "../entities/FileDir";
import type { PaginatedResult } from "../utils/pagination";

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
  return { ...videoFile, video, fileDir, thumbnailKey };
}

class VideoFilesService {
  async findManyPaginated(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const orderByFn = buildVideoFileOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.videoFilesTable.findMany({
        orderBy: orderByFn as Parameters<typeof db.query.videoFilesTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
        with: videoFileWithRelations,
      }),
      db.$count(videoFilesTable),
    ]);
    return { page, pageSize, total: total ?? 0, items: items.map((it) => toVideoFileResponse(it)) };
  }

  async searchPaginated(
    keyword: string,
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const dirsWithPath = await db
      .select({ id: fileDirsTable.id })
      .from(fileDirsTable)
      .where(ilike(fileDirsTable.path, `%${keyword}%`));
    const dirIds = dirsWithPath.map((d) => d.id);
    const conditions = [
      ilike(videoFilesTable.fileKey, `%${keyword}%`),
      ilike(videoFilesTable.uniqueId, `%${keyword}%`),
    ];
    if (dirIds.length > 0) {
      conditions.push(inArray(videoFilesTable.fileDirId, dirIds));
    }
    const condition = or(...conditions);
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
}

export const videoFilesService = new VideoFilesService();
