import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { actorTagsTable } from "../entities/ActorTag";
import { videoActorsTable } from "../entities/VideoActor";
import { videosTable } from "../entities/Video";
import type { PaginatedResult } from "../utils/pagination";

const actorWithTags = {
  actorTags: { with: { tag: { with: { tagType: true } } } },
} as const;

export type CreateActorInput = {
  name: string;
  avatarKey?: string | null;
  tags?: number[];
};

export type UpdateActorInput = {
  name?: string;
  avatarKey?: string | null;
  tags?: number[];
};

const ACTOR_SORT_KEYS = ["id", "name", "createdAt", "updatedAt"] as const;

function toActorResponse(item: { actorTags: Array<{ tag: unknown }> } & Record<string, unknown>) {
  if (!item) return null;
  const { actorTags, ...actor } = item;
  return {
    ...actor,
    tags: actorTags.map((it) => it.tag).filter((tag) => tag != null),
  };
}

function buildActorOrderBy(sortBy?: string, sortOrder?: "asc" | "desc") {
  const col = sortBy && ACTOR_SORT_KEYS.includes(sortBy as (typeof ACTOR_SORT_KEYS)[number])
    ? sortBy
    : "id";
  const isAsc = sortOrder === "asc";
  return (t: typeof actorsTable, op: { asc: (c: unknown) => unknown; desc: (c: unknown) => unknown }) =>
    isAsc ? [op.asc(t[col as keyof typeof t])] : [op.desc(t[col as keyof typeof t])];
}

class ActorsService {
  async findManyPaginated(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const orderByFn = buildActorOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.actorsTable.findMany({
        orderBy: orderByFn as Parameters<typeof db.query.actorsTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
      }),
      db.$count(actorsTable),
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
    const condition = ilike(actorsTable.name, `%${keyword}%`);
    const orderByFn = buildActorOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.actorsTable.findMany({
        where: condition,
        orderBy: orderByFn as Parameters<typeof db.query.actorsTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
      }),
      db.$count(actorsTable, condition),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async findById(id: number) {
    return db.query.actorsTable.findFirst({
      where: eq(actorsTable.id, id),
      with: actorWithTags,
    });
  }

  async findVideosByActorId(
    actorId: number,
    page: number,
    pageSize: number,
    offset: number
  ): Promise<PaginatedResult<unknown>> {
    const videoIds = await db
      .select({ videoId: videoActorsTable.videoId })
      .from(videoActorsTable)
      .where(eq(videoActorsTable.actorId, actorId));
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

  async findByIdWithTags(id: number) {
    const item = await this.findById(id);
    return item ? toActorResponse(item as Parameters<typeof toActorResponse>[0]) : null;
  }

  idsExist(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return Promise.resolve(true);
    return db.query.actorsTable
      .findMany({ where: inArray(actorsTable.id, ids), columns: { id: true } })
      .then((rows) => rows.length === ids.length);
  }

  async create(data: CreateActorInput, tagIds: number[]) {
    const item = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(actorsTable)
        .values({ name: data.name, avatarKey: data.avatarKey ?? null })
        .returning();
      const created = rows[0];
      if (!created) return null;

      if (tagIds.length > 0) {
        await tx.insert(actorTagsTable).values(tagIds.map((tagId) => ({ actorId: created.id, tagId })));
      }

      return tx.query.actorsTable.findFirst({
        where: eq(actorsTable.id, created.id),
        with: actorWithTags,
      });
    });
    return item ? toActorResponse(item as Parameters<typeof toActorResponse>[0]) : null;
  }

  async update(id: number, data: Partial<UpdateActorInput>, tagIds: number[] | undefined) {
    let actorNotFound = false;
    const item = await db.transaction(async (tx) => {
      const rows = await tx
        .update(actorsTable)
        .set({
          name: data.name ?? undefined,
          avatarKey: data.avatarKey ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(actorsTable.id, id))
        .returning();
      if (!rows[0]) {
        actorNotFound = true;
        return null;
      }

      if (tagIds !== undefined) {
        await tx.delete(actorTagsTable).where(eq(actorTagsTable.actorId, id));
        if (tagIds.length > 0) {
          await tx.insert(actorTagsTable).values(tagIds.map((tagId) => ({ actorId: id, tagId })));
        }
      }

      return tx.query.actorsTable.findFirst({
        where: eq(actorsTable.id, id),
        with: actorWithTags,
      });
    });
    return { item: item ? toActorResponse(item as Parameters<typeof toActorResponse>[0]) : null, actorNotFound };
  }

  async updateTagsOnly(id: number, tagIds: number[]) {
    let actorNotFound = false;
    const item = await db.transaction(async (tx) => {
      const rows = await tx
        .update(actorsTable)
        .set({ updatedAt: new Date() })
        .where(eq(actorsTable.id, id))
        .returning({ id: actorsTable.id });
      if (!rows[0]) {
        actorNotFound = true;
        return null;
      }

      await tx.delete(actorTagsTable).where(eq(actorTagsTable.actorId, id));
      if (tagIds.length > 0) {
        await tx.insert(actorTagsTable).values(tagIds.map((tagId) => ({ actorId: id, tagId })));
      }

      return tx.query.actorsTable.findFirst({
        where: eq(actorsTable.id, id),
        with: actorWithTags,
      });
    });
    return { item: item ? toActorResponse(item as Parameters<typeof toActorResponse>[0]) : null, actorNotFound };
  }

  async delete(id: number): Promise<{ item: unknown; hasRefs: boolean }> {
    const refs = await db.query.videoActorsTable.findMany({
      where: eq(videoActorsTable.actorId, id),
      limit: 1,
    });
    if (refs.length > 0) {
      return { item: null, hasRefs: true };
    }

    const rows = await db.delete(actorsTable).where(eq(actorsTable.id, id)).returning();
    return { item: rows[0] ?? null, hasRefs: false };
  }
}

export const actorsService = new ActorsService();
