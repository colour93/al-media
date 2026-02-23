import { eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { videoFilesTable } from "../entities/VideoFile";
import { fileDirsTable } from "../entities/FileDir";
import type { PaginatedResult } from "../utils/pagination";

const videoFileWithRelations = {
  videoFileUnique: {
    with: {
      videoUniqueContents: {
        with: { video: true },
      },
    },
  },
} as const;

function toVideoFileResponse(
  item: { videoFileUnique?: { videoUniqueContents?: Array<{ video: unknown }> } } & Record<string, unknown> | null | undefined
) {
  if (!item) return null;
  const { videoFileUnique, ...videoFile } = item;
  const video = videoFileUnique?.videoUniqueContents?.[0]?.video ?? null;
  return { ...videoFile, video };
}

class VideoFilesService {
  async findManyPaginated(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.videoFilesTable.findMany({
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
        with: videoFileWithRelations,
      }),
      db.$count(videoFilesTable),
    ]);
    return { page, pageSize, total: total ?? 0, items: items.map((it) => toVideoFileResponse(it)) };
  }

  async searchPaginated(keyword: string, page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
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
    const [items, total] = await Promise.all([
      db.query.videoFilesTable.findMany({
        where: condition,
        orderBy: (t, { desc }) => [desc(t.id)],
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
