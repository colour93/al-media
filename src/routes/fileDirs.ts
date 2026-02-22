import { Elysia, t } from "elysia";
import { eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { fileDirsTable } from "../entities/FileDir";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";

export const fileDirsRoutes = new Elysia({ prefix: "/file-dirs" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.fileDirsTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(fileDirsTable),
      ]);

      return {
        page,
        pageSize,
        total: total ?? 0,
        items,
      };
    },
    {
      query: paginationQuerySchema,
    }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) {
        return { message: "invalid search" };
      }

      const { page, pageSize, offset, keyword } = parsed;
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

      return {
        page,
        pageSize,
        total: total ?? 0,
        items,
      };
    },
    {
      query: searchQuerySchema,
    }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "invalid id" };
      }

      const item = await db.query.fileDirsTable.findFirst({
        where: eq(fileDirsTable.id, id),
      });
      if (!item) {
        set.status = 404;
        return { message: "file dir not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const rows = await db
        .insert(fileDirsTable)
        .values({
          path: body.path,
          enabled: body.enabled ?? true,
        })
        .returning();

      set.status = 201;
      return rows[0];
    },
    {
      body: t.Object({
        path: t.String({ minLength: 1 }),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "invalid id" };
      }

      if (body.path === undefined && body.enabled === undefined) {
        set.status = 400;
        return { message: "no fields to update" };
      }

      const rows = await db
        .update(fileDirsTable)
        .set({
          path: body.path ?? undefined,
          enabled: body.enabled ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(fileDirsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "file dir not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        path: t.Optional(t.String({ minLength: 1 })),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "invalid id" };
      }

      const rows = await db
        .delete(fileDirsTable)
        .where(eq(fileDirsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "file dir not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
