import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { actorTagsTable } from "../entities/ActorTag";
import { videoActorsTable } from "../entities/VideoActor";
import { videosTable } from "../entities/Video";
import { creatorsTable } from "../entities/Creator";
import { bindingStrategiesTable } from "../entities/BindingStrategy";
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

export type ActorDeleteImpact = {
  videoRefs: number;
  creatorRefs: number;
  strategyRefs: number;
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

  async merge(targetId: number, sourceIds: number[]) {
    const dedupedSourceIds = [...new Set(sourceIds.filter((id) => Number.isInteger(id) && id > 0 && id !== targetId))];
    if (dedupedSourceIds.length === 0) {
      return { error: "sourceIds 不能为空，且不能包含 targetId" as const };
    }

    const existing = await db.query.actorsTable.findMany({
      where: inArray(actorsTable.id, [targetId, ...dedupedSourceIds]),
      columns: { id: true },
    });
    const existingIds = new Set(existing.map((it) => it.id));
    if (!existingIds.has(targetId)) {
      return { error: "目标演员不存在" as const };
    }
    const missingIds = dedupedSourceIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      return { error: `待合并演员不存在: ${missingIds.join(",")}` as const };
    }

    let movedRefs = 0;
    await db.transaction(async (tx) => {
      for (const sourceId of dedupedSourceIds) {
        const sourceVideoRefs = await tx
          .select({ videoId: videoActorsTable.videoId })
          .from(videoActorsTable)
          .where(eq(videoActorsTable.actorId, sourceId));
        const sourceVideoIds = [...new Set(sourceVideoRefs.map((it) => it.videoId))];
        if (sourceVideoIds.length > 0) {
          const targetVideoRefs = await tx
            .select({ videoId: videoActorsTable.videoId })
            .from(videoActorsTable)
            .where(eq(videoActorsTable.actorId, targetId));
          const targetVideoIdSet = new Set(targetVideoRefs.map((it) => it.videoId));
          const toInsert = sourceVideoIds
            .filter((videoId) => !targetVideoIdSet.has(videoId))
            .map((videoId) => ({ videoId, actorId: targetId }));
          if (toInsert.length > 0) {
            await tx.insert(videoActorsTable).values(toInsert);
            movedRefs += toInsert.length;
          }
          await tx.delete(videoActorsTable).where(eq(videoActorsTable.actorId, sourceId));
        }

        const movedCreators = await tx
          .update(creatorsTable)
          .set({ actorId: targetId, updatedAt: new Date() })
          .where(eq(creatorsTable.actorId, sourceId))
          .returning({ id: creatorsTable.id });
        movedRefs += movedCreators.length;

        const sourceTags = await tx
          .select({ tagId: actorTagsTable.tagId })
          .from(actorTagsTable)
          .where(eq(actorTagsTable.actorId, sourceId));
        const sourceTagIds = [...new Set(sourceTags.map((it) => it.tagId))];
        if (sourceTagIds.length > 0) {
          const targetTags = await tx
            .select({ tagId: actorTagsTable.tagId })
            .from(actorTagsTable)
            .where(eq(actorTagsTable.actorId, targetId));
          const targetTagIdSet = new Set(targetTags.map((it) => it.tagId));
          const tagPairsToInsert = sourceTagIds
            .filter((tagId) => !targetTagIdSet.has(tagId))
            .map((tagId) => ({ actorId: targetId, tagId }));
          if (tagPairsToInsert.length > 0) {
            await tx.insert(actorTagsTable).values(tagPairsToInsert);
            movedRefs += tagPairsToInsert.length;
          }
          await tx.delete(actorTagsTable).where(eq(actorTagsTable.actorId, sourceId));
        }

        await tx.delete(actorsTable).where(eq(actorsTable.id, sourceId));
      }

      const sourceIdSet = new Set(dedupedSourceIds);
      const strategies = await tx.query.bindingStrategiesTable.findMany({
        columns: { id: true, actorIds: true },
      });
      for (const strategy of strategies) {
        const actorIds = strategy.actorIds ?? [];
        if (!actorIds.some((id) => sourceIdSet.has(id))) continue;
        const mergedActorIds = [...new Set(actorIds.map((id) => (sourceIdSet.has(id) ? targetId : id)))];
        await tx
          .update(bindingStrategiesTable)
          .set({ actorIds: mergedActorIds, updatedAt: new Date() })
          .where(eq(bindingStrategiesTable.id, strategy.id));
      }

      await tx.update(actorsTable).set({ updatedAt: new Date() }).where(eq(actorsTable.id, targetId));
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

  async getDeleteImpact(id: number): Promise<ActorDeleteImpact> {
    const [videoRefsCount, creatorRefsCount, strategyRows] = await Promise.all([
      db.$count(videoActorsTable, eq(videoActorsTable.actorId, id)),
      db.$count(creatorsTable, eq(creatorsTable.actorId, id)),
      db.query.bindingStrategiesTable.findMany({
        columns: { actorIds: true },
      }),
    ]);
    const strategyRefs = strategyRows.reduce((count, row) => {
      const actorIds = row.actorIds ?? [];
      return actorIds.includes(id) ? count + 1 : count;
    }, 0);
    return {
      videoRefs: Number(videoRefsCount ?? 0),
      creatorRefs: Number(creatorRefsCount ?? 0),
      strategyRefs,
    };
  }

  async delete(
    id: number,
    options?: { force?: boolean }
  ): Promise<{ item: unknown; notFound: boolean; blocked: boolean; impact: ActorDeleteImpact }> {
    const existing = await db.query.actorsTable.findFirst({
      where: eq(actorsTable.id, id),
      columns: { id: true },
    });
    if (!existing) {
      return {
        item: null,
        notFound: true,
        blocked: false,
        impact: { videoRefs: 0, creatorRefs: 0, strategyRefs: 0 },
      };
    }

    const impact = await this.getDeleteImpact(id);
    const hasRefs = impact.videoRefs > 0 || impact.creatorRefs > 0 || impact.strategyRefs > 0;
    if (hasRefs && !options?.force) {
      return { item: null, notFound: false, blocked: true, impact };
    }

    const item = await db.transaction(async (tx) => {
      if (impact.videoRefs > 0) {
        await tx.delete(videoActorsTable).where(eq(videoActorsTable.actorId, id));
      }
      if (impact.creatorRefs > 0) {
        await tx
          .update(creatorsTable)
          .set({ actorId: null, updatedAt: new Date() })
          .where(eq(creatorsTable.actorId, id));
      }
      if (impact.strategyRefs > 0) {
        const strategies = await tx.query.bindingStrategiesTable.findMany({
          columns: { id: true, actorIds: true },
        });
        for (const strategy of strategies) {
          const actorIds = strategy.actorIds ?? [];
          if (!actorIds.includes(id)) continue;
          const nextActorIds = actorIds.filter((actorId) => actorId !== id);
          await tx
            .update(bindingStrategiesTable)
            .set({ actorIds: nextActorIds, updatedAt: new Date() })
            .where(eq(bindingStrategiesTable.id, strategy.id));
        }
      }
      const rows = await tx.delete(actorsTable).where(eq(actorsTable.id, id)).returning();
      return rows[0] ?? null;
    });

    return { item, notFound: false, blocked: false, impact };
  }
}

export const actorsService = new ActorsService();
