import { eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { distributorsTable } from "../entities/Distributor";
import { videoDistributorsTable } from "../entities/VideoDistributor";
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
  async findManyPaginated(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.distributorsTable.findMany({
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(distributorsTable),
    ]);
    return { page, pageSize, total: total ?? 0, items };
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
    return { page, pageSize, total: total ?? 0, items };
  }

  async findById(id: number) {
    return db.query.distributorsTable.findFirst({
      where: eq(distributorsTable.id, id),
    });
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
    await db.delete(videoDistributorsTable).where(eq(videoDistributorsTable.distributorId, id));
    const rows = await db.delete(distributorsTable).where(eq(distributorsTable.id, id)).returning();
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
