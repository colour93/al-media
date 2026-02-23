import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { creatorsTable } from "../entities/Creator";
import { creatorTagsTable } from "../entities/CreatorTag";
import { videoCreatorsTable } from "../entities/VideoCreator";
import type { PaginatedResult } from "../utils/pagination";

export type CreatorPlatform = "onlyfans" | "justforfans" | "fansone" | "fansonly";

const creatorWithRelations = {
  actor: true,
  creatorTags: { with: { tag: true } },
} as const;

export type CreateCreatorInput = {
  name: string;
  type: "person" | "group";
  actorId?: number | null;
  platform?: CreatorPlatform | null;
  platformId?: string | null;
  tags?: number[];
};

export type UpdateCreatorInput = {
  name?: string;
  type?: "person" | "group";
  actorId?: number | null;
  platform?: CreatorPlatform | null;
  platformId?: string | null;
  tags?: number[];
};

function toCreatorResponse(item: { creatorTags: Array<{ tag: unknown }> } & Record<string, unknown>) {
  if (!item) return null;
  const { creatorTags, ...creator } = item;
  return {
    ...creator,
    tags: creatorTags.map((it) => it.tag).filter((tag) => tag != null),
  };
}

class CreatorsService {
  async findManyPaginated(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.creatorsTable.findMany({
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(creatorsTable),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async searchPaginated(keyword: string, page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const condition = ilike(creatorsTable.name, `%${keyword}%`);
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

  async findById(id: number) {
    return db.query.creatorsTable.findFirst({
      where: eq(creatorsTable.id, id),
      with: creatorWithRelations,
    });
  }

  async findByIdWithTags(id: number) {
    const item = await this.findById(id);
    return item ? toCreatorResponse(item as Parameters<typeof toCreatorResponse>[0]) : null;
  }

  idsExist(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return Promise.resolve(true);
    return db.query.creatorsTable
      .findMany({ where: inArray(creatorsTable.id, ids), columns: { id: true } })
      .then((rows) => rows.length === ids.length);
  }

  async actorExists(actorId: number): Promise<boolean> {
    const item = await db.query.actorsTable.findFirst({
      where: eq(actorsTable.id, actorId),
      columns: { id: true },
    });
    return !!item;
  }

  async create(data: CreateCreatorInput, tagIds: number[]) {
    const item = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(creatorsTable)
        .values({
          name: data.name,
          type: data.type,
          actorId: data.actorId ?? null,
          platform: data.platform ?? null,
          platformId: data.platformId ?? null,
        })
        .returning();
      const created = rows[0];
      if (!created) return null;

      if (tagIds.length > 0) {
        await tx.insert(creatorTagsTable).values(tagIds.map((tagId) => ({ creatorId: created.id, tagId })));
      }

      return tx.query.creatorsTable.findFirst({
        where: eq(creatorsTable.id, created.id),
        with: creatorWithRelations,
      });
    });
    return item ? toCreatorResponse(item as Parameters<typeof toCreatorResponse>[0]) : null;
  }

  async update(id: number, data: Partial<UpdateCreatorInput>, tagIds: number[] | undefined) {
    let creatorNotFound = false;
    const item = await db.transaction(async (tx) => {
      const rows = await tx
        .update(creatorsTable)
        .set({
          name: data.name ?? undefined,
          type: data.type ?? undefined,
          actorId: data.actorId !== undefined ? data.actorId : undefined,
          platform: data.platform !== undefined ? data.platform : undefined,
          platformId: data.platformId !== undefined ? data.platformId : undefined,
          updatedAt: new Date(),
        })
        .where(eq(creatorsTable.id, id))
        .returning();
      if (!rows[0]) {
        creatorNotFound = true;
        return null;
      }

      if (tagIds !== undefined) {
        await tx.delete(creatorTagsTable).where(eq(creatorTagsTable.creatorId, id));
        if (tagIds.length > 0) {
          await tx.insert(creatorTagsTable).values(tagIds.map((tagId) => ({ creatorId: id, tagId })));
        }
      }

      return tx.query.creatorsTable.findFirst({
        where: eq(creatorsTable.id, id),
        with: creatorWithRelations,
      });
    });
    return { item: item ? toCreatorResponse(item as Parameters<typeof toCreatorResponse>[0]) : null, creatorNotFound };
  }

  async updateTagsOnly(id: number, tagIds: number[]) {
    let creatorNotFound = false;
    const item = await db.transaction(async (tx) => {
      const rows = await tx
        .update(creatorsTable)
        .set({ updatedAt: new Date() })
        .where(eq(creatorsTable.id, id))
        .returning({ id: creatorsTable.id });
      if (!rows[0]) {
        creatorNotFound = true;
        return null;
      }

      await tx.delete(creatorTagsTable).where(eq(creatorTagsTable.creatorId, id));
      if (tagIds.length > 0) {
        await tx.insert(creatorTagsTable).values(tagIds.map((tagId) => ({ creatorId: id, tagId })));
      }

      return tx.query.creatorsTable.findFirst({
        where: eq(creatorsTable.id, id),
        with: creatorWithRelations,
      });
    });
    return { item: item ? toCreatorResponse(item as Parameters<typeof toCreatorResponse>[0]) : null, creatorNotFound };
  }

  async delete(id: number): Promise<{ item: unknown; hasRefs: boolean }> {
    const refs = await db.query.videoCreatorsTable.findMany({
      where: eq(videoCreatorsTable.creatorId, id),
      limit: 1,
    });
    if (refs.length > 0) {
      return { item: null, hasRefs: true };
    }

    const rows = await db.delete(creatorsTable).where(eq(creatorsTable.id, id)).returning();
    return { item: rows[0] ?? null, hasRefs: false };
  }
}

export const creatorsService = new CreatorsService();
