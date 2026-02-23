import { eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { tagTypesTable } from "../entities/Tag";
import type { PaginatedResult } from "../utils/pagination";

export type CreateTagTypeInput = {
  name: string;
  icon?: string | null;
};

export type UpdateTagTypeInput = {
  name?: string;
  icon?: string | null;
};

class TagTypesService {
  async findManyPaginated(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.tagTypesTable.findMany({
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(tagTypesTable),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async searchPaginated(keyword: string, page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const condition = ilike(tagTypesTable.name, `%${keyword}%`);
    const [items, total] = await Promise.all([
      db.query.tagTypesTable.findMany({
        where: condition,
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(tagTypesTable, condition),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async findById(id: number) {
    return db.query.tagTypesTable.findFirst({
      where: eq(tagTypesTable.id, id),
    });
  }

  async create(data: CreateTagTypeInput) {
    const rows = await db
      .insert(tagTypesTable)
      .values({ name: data.name, icon: data.icon ?? null })
      .returning();
    return rows[0] ?? null;
  }

  async update(id: number, data: UpdateTagTypeInput) {
    const rows = await db
      .update(tagTypesTable)
      .set({
        name: data.name ?? undefined,
        icon: data.icon ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(tagTypesTable.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async delete(id: number) {
    const rows = await db.delete(tagTypesTable).where(eq(tagTypesTable.id, id)).returning();
    return rows[0] ?? null;
  }
}

export const tagTypesService = new TagTypesService();
