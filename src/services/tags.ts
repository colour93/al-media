import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { tagsTable } from "../entities/Tag";
import { actorsTable } from "../entities/Actor";
import { creatorsTable } from "../entities/Creator";
import { videosTable } from "../entities/Video";
import { actorTagsTable } from "../entities/ActorTag";
import { creatorTagsTable } from "../entities/CreatorTag";
import { videoTagsTable } from "../entities/VideoTag";
import type { PaginatedResult } from "../utils/pagination";

export type TagRelatedCategory = "actor" | "creator" | "video";

export type CreateTagInput = {
  name: string;
  tagTypeId: number;
  color?: string | null;
};

export type UpdateTagInput = {
  name?: string;
  tagTypeId?: number;
  color?: string | null;
};

const TAG_SORT_KEYS = ["id", "name", "tagTypeId", "createdAt", "updatedAt"] as const;

function buildTagOrderBy(sortBy?: string, sortOrder?: "asc" | "desc") {
  const col = sortBy && TAG_SORT_KEYS.includes(sortBy as (typeof TAG_SORT_KEYS)[number])
    ? sortBy
    : "id";
  const isAsc = sortOrder === "asc";
  return (t: typeof tagsTable, op: { asc: (c: unknown) => unknown; desc: (c: unknown) => unknown }) =>
    isAsc ? [op.asc(t[col as keyof typeof t])] : [op.desc(t[col as keyof typeof t])];
}

class TagsService {
  async findManyPaginated(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const orderByFn = buildTagOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.tagsTable.findMany({
        orderBy: orderByFn as Parameters<typeof db.query.tagsTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
        with: { tagType: true },
      }),
      db.$count(tagsTable),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async searchPaginated(
    keyword: string,
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const condition = ilike(tagsTable.name, `%${keyword}%`);
    const orderByFn = buildTagOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.tagsTable.findMany({
        where: condition,
        orderBy: orderByFn as Parameters<typeof db.query.tagsTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
      }),
      db.$count(tagsTable, condition),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async findById(id: number) {
    return db.query.tagsTable.findFirst({
      where: eq(tagsTable.id, id),
    });
  }

  async findRelatedByCategory(
    tagId: number,
    category: TagRelatedCategory,
    page: number,
    pageSize: number,
    offset: number
  ): Promise<PaginatedResult<unknown>> {
    if (category === "video") {
      const videoIds = await db
        .select({ videoId: videoTagsTable.videoId })
        .from(videoTagsTable)
        .where(eq(videoTagsTable.tagId, tagId));
      const ids = videoIds.map((v) => v.videoId);
      if (ids.length === 0) {
        return { page, pageSize, total: 0, items: [] };
      }
      const condition = inArray(videosTable.id, ids);
      const [items, total] = await Promise.all([
        db.query.videosTable.findMany({
          where: condition,
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(videosTable, condition),
      ]);
      return { page, pageSize, total: total ?? 0, items };
    }
    if (category === "actor") {
      const actorIds = await db
        .select({ actorId: actorTagsTable.actorId })
        .from(actorTagsTable)
        .where(eq(actorTagsTable.tagId, tagId));
      const ids = actorIds.map((a) => a.actorId);
      if (ids.length === 0) {
        return { page, pageSize, total: 0, items: [] };
      }
      const condition = inArray(actorsTable.id, ids);
      const [items, total] = await Promise.all([
        db.query.actorsTable.findMany({
          where: condition,
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(actorsTable, condition),
      ]);
      return { page, pageSize, total: total ?? 0, items };
    }
    if (category === "creator") {
      const creatorIds = await db
        .select({ creatorId: creatorTagsTable.creatorId })
        .from(creatorTagsTable)
        .where(eq(creatorTagsTable.tagId, tagId));
      const ids = creatorIds.map((c) => c.creatorId);
      if (ids.length === 0) {
        return { page, pageSize, total: 0, items: [] };
      }
      const condition = inArray(creatorsTable.id, ids);
      const [items, total] = await Promise.all([
        db.query.creatorsTable.findMany({
          where: condition,
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(creatorsTable, condition),
      ]);
      return { page, pageSize, total: total ?? 0, items };
    }
    return { page, pageSize, total: 0, items: [] };
  }

  idsExist(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return Promise.resolve(true);
    return db.query.tagsTable
      .findMany({ where: inArray(tagsTable.id, ids), columns: { id: true } })
      .then((rows) => rows.length === ids.length);
  }

  async create(data: CreateTagInput) {
    const rows = await db
      .insert(tagsTable)
      .values({ name: data.name, tagTypeId: data.tagTypeId, color: data.color ?? null })
      .returning();
    return rows[0] ?? null;
  }

  async update(id: number, data: UpdateTagInput) {
    const rows = await db
      .update(tagsTable)
      .set({
        name: data.name ?? undefined,
        tagTypeId: data.tagTypeId ?? undefined,
        color: data.color ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(tagsTable.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async delete(id: number) {
    const rows = await db.delete(tagsTable).where(eq(tagsTable.id, id)).returning();
    return rows[0] ?? null;
  }
}

export const tagsService = new TagsService();
