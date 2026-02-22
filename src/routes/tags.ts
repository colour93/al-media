import { Elysia, t } from "elysia";
import { eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { tagsTable } from "../entities/Tag";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";

export const tagsRoutes = new Elysia({ prefix: "/tags" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.tagsTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(tagsTable),
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

      const item = await db.query.tagsTable.findFirst({
        where: eq(tagsTable.id, id),
      });
      if (!item) {
        set.status = 404;
        return { message: "tag not found" };
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
        .insert(tagsTable)
        .values({
          name: body.name,
          tagTypeId: body.tagTypeId,
          color: body.color ?? null,
        })
        .returning();

      set.status = 201;
      return rows[0];
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        tagTypeId: t.Integer(),
        color: t.Optional(t.String()),
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

      if (!body.name && body.tagTypeId === undefined && !body.color) {
        set.status = 400;
        return { message: "no fields to update" };
      }

      const rows = await db
        .update(tagsTable)
        .set({
          name: body.name ?? undefined,
          tagTypeId: body.tagTypeId ?? undefined,
          color: body.color ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(tagsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "tag not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        tagTypeId: t.Optional(t.Integer()),
        color: t.Optional(t.String()),
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
        .delete(tagsTable)
        .where(eq(tagsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "tag not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
