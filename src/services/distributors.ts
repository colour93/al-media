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
