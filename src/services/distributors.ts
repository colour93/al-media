import { eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { distributorsTable } from "../entities/Distributor";
import { videoDistributorsTable } from "../entities/VideoDistributor";
import { bindingStrategiesTable } from "../entities/BindingStrategy";
import { videoTagsTable } from "../entities/VideoTag";
import { tagsTable } from "../entities/Tag";
import type { PaginatedResult } from "../utils/pagination";

export type CreateDistributorInput = {
  name: string;
  domain?: string | null;
};

export type UpdateDistributorInput = {
  name?: string;
  domain?: string | null;
};

class DistributorsService {
  private async getDistributorTagsMap(distributorIds: number[]) {
    const map = new Map<number, unknown[]>();
    const uniqueIds = [...new Set(distributorIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueIds.length === 0) return map;

    const refs = await db
      .select({
        distributorId: videoDistributorsTable.distributorId,
        tagId: videoTagsTable.tagId,
      })
      .from(videoDistributorsTable)
      .innerJoin(videoTagsTable, eq(videoTagsTable.videoId, videoDistributorsTable.videoId))
      .where(inArray(videoDistributorsTable.distributorId, uniqueIds));

    const tagIds = [...new Set(refs.map((row) => row.tagId))];
    if (tagIds.length === 0) return map;

    const tags = await db.query.tagsTable.findMany({
      where: inArray(tagsTable.id, tagIds),
      with: { tagType: true },
    });
    const tagMap = new Map<number, unknown>(
      (tags as Array<{ id: number }>).map((tag) => [tag.id, tag as unknown])
    );
    const distributorTagIdMap = new Map<number, Set<number>>();
    for (const row of refs) {
      if (!tagMap.has(row.tagId)) continue;
      if (!distributorTagIdMap.has(row.distributorId)) {
        distributorTagIdMap.set(row.distributorId, new Set<number>());
      }
      distributorTagIdMap.get(row.distributorId)!.add(row.tagId);
    }

    for (const [distributorId, distributorTagIds] of distributorTagIdMap) {
      map.set(
        distributorId,
        Array.from(distributorTagIds)
          .map((tagId) => tagMap.get(tagId))
          .filter((tag): tag is unknown => tag != null)
      );
    }
    return map;
  }

  async findManyPaginated(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.distributorsTable.findMany({
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(distributorsTable),
    ]);
    const tagMap = await this.getDistributorTagsMap(
      (items as Array<{ id: number }>).map((item) => item.id)
    );
    return {
      page,
      pageSize,
      total: total ?? 0,
      items: (items as Array<{ id: number }>).map((item) => ({
        ...item,
        tags: tagMap.get(item.id) ?? [],
      })),
    };
  }

  async searchPaginated(keyword: string, page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const condition = or(
      ilike(distributorsTable.name, `%${keyword}%`),
      ilike(distributorsTable.domain, `%${keyword}%`)
    );
    const [items, total] = await Promise.all([
      db.query.distributorsTable.findMany({
        where: condition,
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(distributorsTable, condition),
    ]);
    const tagMap = await this.getDistributorTagsMap(
      (items as Array<{ id: number }>).map((item) => item.id)
    );
    return {
      page,
      pageSize,
      total: total ?? 0,
      items: (items as Array<{ id: number }>).map((item) => ({
        ...item,
        tags: tagMap.get(item.id) ?? [],
      })),
    };
  }

  async findById(id: number) {
    const item = await db.query.distributorsTable.findFirst({
      where: eq(distributorsTable.id, id),
    });
    if (!item) return null;
    const tagMap = await this.getDistributorTagsMap([id]);
    return {
      ...item,
      tags: tagMap.get(id) ?? [],
    };
  }

  idsExist(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return Promise.resolve(true);
    return db.query.distributorsTable
      .findMany({ where: inArray(distributorsTable.id, ids), columns: { id: true } })
      .then((rows) => rows.length === ids.length);
  }

  async create(data: CreateDistributorInput) {
    const rows = await db
      .insert(distributorsTable)
      .values({ name: data.name, domain: data.domain ?? null })
      .returning();
    return rows[0] ?? null;
  }

  async update(id: number, data: UpdateDistributorInput) {
    const rows = await db
      .update(distributorsTable)
      .set({
        name: data.name ?? undefined,
        domain: data.domain ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(distributorsTable.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async merge(targetId: number, sourceIds: number[]) {
    const dedupedSourceIds = [...new Set(sourceIds.filter((id) => Number.isInteger(id) && id > 0 && id !== targetId))];
    if (dedupedSourceIds.length === 0) {
      return { error: "sourceIds 不能为空，且不能包含 targetId" as const };
    }

    const existing = await db.query.distributorsTable.findMany({
      where: inArray(distributorsTable.id, [targetId, ...dedupedSourceIds]),
      columns: { id: true },
    });
    const existingIds = new Set(existing.map((it) => it.id));
    if (!existingIds.has(targetId)) {
      return { error: "目标发行方不存在" as const };
    }
    const missingIds = dedupedSourceIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      return { error: `待合并发行方不存在: ${missingIds.join(",")}` as const };
    }

    let movedRefs = 0;
    await db.transaction(async (tx) => {
      for (const sourceId of dedupedSourceIds) {
        const sourceVideoRefs = await tx
          .select({ videoId: videoDistributorsTable.videoId })
          .from(videoDistributorsTable)
          .where(eq(videoDistributorsTable.distributorId, sourceId));
        const sourceVideoIds = [...new Set(sourceVideoRefs.map((it) => it.videoId))];
        if (sourceVideoIds.length > 0) {
          const targetVideoRefs = await tx
            .select({ videoId: videoDistributorsTable.videoId })
            .from(videoDistributorsTable)
            .where(eq(videoDistributorsTable.distributorId, targetId));
          const targetVideoIdSet = new Set(targetVideoRefs.map((it) => it.videoId));
          const toInsert = sourceVideoIds
            .filter((videoId) => !targetVideoIdSet.has(videoId))
            .map((videoId) => ({ videoId, distributorId: targetId }));
          if (toInsert.length > 0) {
            await tx.insert(videoDistributorsTable).values(toInsert);
            movedRefs += toInsert.length;
          }
          await tx.delete(videoDistributorsTable).where(eq(videoDistributorsTable.distributorId, sourceId));
        }

        await tx.delete(distributorsTable).where(eq(distributorsTable.id, sourceId));
      }

      const sourceIdSet = new Set(dedupedSourceIds);
      const strategies = await tx.query.bindingStrategiesTable.findMany({
        columns: { id: true, distributorIds: true },
      });
      for (const strategy of strategies) {
        const distributorIds = strategy.distributorIds ?? [];
        if (!distributorIds.some((id) => sourceIdSet.has(id))) continue;
        const mergedDistributorIds = [
          ...new Set(distributorIds.map((id) => (sourceIdSet.has(id) ? targetId : id))),
        ];
        await tx
          .update(bindingStrategiesTable)
          .set({ distributorIds: mergedDistributorIds, updatedAt: new Date() })
          .where(eq(bindingStrategiesTable.id, strategy.id));
      }

      await tx.update(distributorsTable).set({ updatedAt: new Date() }).where(eq(distributorsTable.id, targetId));
    });

    const item = await this.findById(targetId);
    return {
      item,
      targetId,
      mergedIds: dedupedSourceIds,
      removed: dedupedSourceIds.length,
      movedRefs,
    };
  }

  async delete(id: number) {
    const rows = await db.transaction(async (tx) => {
      await tx.delete(videoDistributorsTable).where(eq(videoDistributorsTable.distributorId, id));
      const strategies = await tx.query.bindingStrategiesTable.findMany({
        columns: { id: true, distributorIds: true },
      });
      for (const strategy of strategies) {
        const distributorIds = strategy.distributorIds ?? [];
        if (!distributorIds.includes(id)) continue;
        const nextDistributorIds = distributorIds.filter((distributorId) => distributorId !== id);
        await tx
          .update(bindingStrategiesTable)
          .set({ distributorIds: nextDistributorIds, updatedAt: new Date() })
          .where(eq(bindingStrategiesTable.id, strategy.id));
      }
      return tx.delete(distributorsTable).where(eq(distributorsTable.id, id)).returning();
    });
    return rows[0] ?? null;
  }

  /** 按名称或规范化名称（忽略空格、大小写）查找，用于 LLM 推理去重 */
  async findByNameOrNormalized(name: string) {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, "");
    if (!normalized) return null;
    return db.query.distributorsTable.findFirst({
      where: or(
        ilike(distributorsTable.name, `%${name.trim()}%`),
        sql`lower(replace(${distributorsTable.name}, ' ', '')) = ${normalized}`
      ),
      columns: { id: true, name: true },
    });
  }
}

export const distributorsService = new DistributorsService();
