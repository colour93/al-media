import { eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { fileDirsTable } from "../entities/FileDir";
import { videoFileManager } from "./videoFileManager";
import type { PaginatedResult } from "../utils/pagination";

export type CreateFileDirInput = {
  path: string;
  enabled?: boolean;
};

export type UpdateFileDirInput = {
  enabled?: boolean;
};

class FileDirsService {
  private triggerInit() {
    videoFileManager.init();
  }

  async findManyPaginated(page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const [items, total] = await Promise.all([
      db.query.fileDirsTable.findMany({
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(fileDirsTable),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async searchPaginated(keyword: string, page: number, pageSize: number, offset: number): Promise<PaginatedResult<unknown>> {
    const condition = ilike(fileDirsTable.path, `%${keyword}%`);
    const [items, total] = await Promise.all([
      db.query.fileDirsTable.findMany({
        where: condition,
        orderBy: (t, { desc }) => [desc(t.id)],
        limit: pageSize,
        offset,
      }),
      db.$count(fileDirsTable, condition),
    ]);
    return { page, pageSize, total: total ?? 0, items };
  }

  async findById(id: number) {
    return db.query.fileDirsTable.findFirst({
      where: eq(fileDirsTable.id, id),
    });
  }

  async create(data: CreateFileDirInput) {
    const rows = await db
      .insert(fileDirsTable)
      .values({ path: data.path, enabled: data.enabled ?? true })
      .returning();
    const item = rows[0] ?? null;
    if (item) this.triggerInit();
    return item;
  }

  async update(id: number, data: UpdateFileDirInput) {
    const rows = await db
      .update(fileDirsTable)
      .set({
        enabled: data.enabled ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(fileDirsTable.id, id))
      .returning();
    const item = rows[0] ?? null;
    if (item) this.triggerInit();
    return item;
  }

  async delete(id: number) {
    const rows = await db.delete(fileDirsTable).where(eq(fileDirsTable.id, id)).returning();
    const item = rows[0] ?? null;
    if (item) this.triggerInit();
    return item;
  }
}

export const fileDirsService = new FileDirsService();
