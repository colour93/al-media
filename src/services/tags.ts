import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { tagsTable } from "../entities/Tag";
import type { PaginatedResult } from "../utils/pagination";

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

class TagsService {
  async findManyPaginated(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.tagsTable.findMany({
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
        with: { tagType: true },
      }),
      db.$count(tagsTable),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async searchPaginated(keyword: string, page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const condition = ilike(tagsTable.name, `%${keyword}%`);
    const [items, total] = await Promise.all([
      db.query.tagsTable.findMany({
        where: condition,
        orderBy: (t, { desc }) => [desc(t.id)],
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
