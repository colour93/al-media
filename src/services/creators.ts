import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { creatorsTable } from "../entities/Creator";
import { creatorTagsTable } from "../entities/CreatorTag";
import { videoCreatorsTable } from "../entities/VideoCreator";
import { videosTable } from "../entities/Video";
import { bindingStrategiesTable } from "../entities/BindingStrategy";
import type { PaginatedResult } from "../utils/pagination";

export type CreatorPlatform = "onlyfans" | "justforfans" | "fansone" | "fansonly";

const CREATOR_SORT_KEYS = ["id", "name", "type", "createdAt", "updatedAt"] as const;

const creatorWithRelations = {
  actor: true,
  creatorTags: { with: { tag: { with: { tagType: true } } } },
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

function buildCreatorOrderBy(sortBy?: string, sortOrder?: "asc" | "desc") {
  const col = sortBy && CREATOR_SORT_KEYS.includes(sortBy as (typeof CREATOR_SORT_KEYS)[number])
    ? sortBy
    : "id";
  const isAsc = sortOrder === "asc";
  return (t: typeof creatorsTable, op: { asc: (c: unknown) => unknown; desc: (c: unknown) => unknown }) =>
    isAsc ? [op.asc(t[col as keyof typeof t])] : [op.desc(t[col as keyof typeof t])];
}

class CreatorsService {
  async findManyPaginated(
    page: number,
    pageSize: number,
    offset: number,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PaginatedResult<unknown>> {
    const orderByFn = buildCreatorOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.creatorsTable.findMany({
        orderBy: orderByFn as Parameters<typeof db.query.creatorsTable.findMany>[0]["orderBy"],
        limit: pageSize,
        offset,
      }),
      db.$count(creatorsTable),
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
    const condition = ilike(creatorsTable.name, `%${keyword}%`);
    const orderByFn = buildCreatorOrderBy(sortBy, sortOrder);
    const [items, total] = await Promise.all([
      db.query.creatorsTable.findMany({
        where: condition,
        orderBy: orderByFn as Parameters<typeof db.query.creatorsTable.findMany>[0]["orderBy"],
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

  async findCreatorsByActorId(actorId: number): Promise<unknown[]> {
    const items = await db.query.creatorsTable.findMany({
      where: eq(creatorsTable.actorId, actorId),
      with: creatorWithRelations,
      orderBy: (t, { desc }) => [desc(t.id)],
    });
    return items.map((it) => toCreatorResponse(it as Parameters<typeof toCreatorResponse>[0]));
  }

  async findVideosByCreatorId(
    creatorId: number,
    page: number,
    pageSize: number,
    offset: number
  ): Promise<PaginatedResult<unknown>> {
    const videoIds = await db
      .select({ videoId: videoCreatorsTable.videoId })
      .from(videoCreatorsTable)
      .where(eq(videoCreatorsTable.creatorId, creatorId));
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

  async merge(targetId: number, sourceIds: number[]) {
    const dedupedSourceIds = [...new Set(sourceIds.filter((id) => Number.isInteger(id) && id > 0 && id !== targetId))];
    if (dedupedSourceIds.length === 0) {
      return { error: "sourceIds 不能为空，且不能包含 targetId" as const };
    }

    const existing = await db.query.creatorsTable.findMany({
      where: inArray(creatorsTable.id, [targetId, ...dedupedSourceIds]),
      columns: { id: true },
    });
    const existingIds = new Set(existing.map((it) => it.id));
    if (!existingIds.has(targetId)) {
      return { error: "目标创作者不存在" as const };
    }
    const missingIds = dedupedSourceIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      return { error: `待合并创作者不存在: ${missingIds.join(",")}` as const };
    }

    let movedRefs = 0;
    await db.transaction(async (tx) => {
      for (const sourceId of dedupedSourceIds) {
        const sourceVideoRefs = await tx
          .select({ videoId: videoCreatorsTable.videoId })
          .from(videoCreatorsTable)
          .where(eq(videoCreatorsTable.creatorId, sourceId));
        const sourceVideoIds = [...new Set(sourceVideoRefs.map((it) => it.videoId))];
        if (sourceVideoIds.length > 0) {
          const targetVideoRefs = await tx
            .select({ videoId: videoCreatorsTable.videoId })
            .from(videoCreatorsTable)
            .where(eq(videoCreatorsTable.creatorId, targetId));
          const targetVideoIdSet = new Set(targetVideoRefs.map((it) => it.videoId));
          const toInsert = sourceVideoIds
            .filter((videoId) => !targetVideoIdSet.has(videoId))
            .map((videoId) => ({ videoId, creatorId: targetId }));
          if (toInsert.length > 0) {
            await tx.insert(videoCreatorsTable).values(toInsert);
            movedRefs += toInsert.length;
          }
          await tx.delete(videoCreatorsTable).where(eq(videoCreatorsTable.creatorId, sourceId));
        }

        const sourceTags = await tx
          .select({ tagId: creatorTagsTable.tagId })
          .from(creatorTagsTable)
          .where(eq(creatorTagsTable.creatorId, sourceId));
        const sourceTagIds = [...new Set(sourceTags.map((it) => it.tagId))];
        if (sourceTagIds.length > 0) {
          const targetTags = await tx
            .select({ tagId: creatorTagsTable.tagId })
            .from(creatorTagsTable)
            .where(eq(creatorTagsTable.creatorId, targetId));
          const targetTagIdSet = new Set(targetTags.map((it) => it.tagId));
          const tagPairsToInsert = sourceTagIds
            .filter((tagId) => !targetTagIdSet.has(tagId))
            .map((tagId) => ({ creatorId: targetId, tagId }));
          if (tagPairsToInsert.length > 0) {
            await tx.insert(creatorTagsTable).values(tagPairsToInsert);
            movedRefs += tagPairsToInsert.length;
          }
          await tx.delete(creatorTagsTable).where(eq(creatorTagsTable.creatorId, sourceId));
        }

        await tx.delete(creatorsTable).where(eq(creatorsTable.id, sourceId));
      }

      const sourceIdSet = new Set(dedupedSourceIds);
      const strategies = await tx.query.bindingStrategiesTable.findMany({
        columns: { id: true, creatorIds: true },
      });
      for (const strategy of strategies) {
        const creatorIds = strategy.creatorIds ?? [];
        if (!creatorIds.some((id) => sourceIdSet.has(id))) continue;
        const mergedCreatorIds = [...new Set(creatorIds.map((id) => (sourceIdSet.has(id) ? targetId : id)))];
        await tx
          .update(bindingStrategiesTable)
          .set({ creatorIds: mergedCreatorIds, updatedAt: new Date() })
          .where(eq(bindingStrategiesTable.id, strategy.id));
      }

      await tx.update(creatorsTable).set({ updatedAt: new Date() }).where(eq(creatorsTable.id, targetId));
    });

    const item = await this.findByIdWithTags(targetId);
    return {
      item,
      targetId,
      mergedIds: dedupedSourceIds,
      removed: dedupedSourceIds.length,
      movedRefs,
    };
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
