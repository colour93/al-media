import { Elysia, t } from "elysia";
import { eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { tagTypesTable } from "../entities/Tag";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";

export const tagTypesRoutes = new Elysia({ prefix: "/tag-types" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.tagTypesTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(tagTypesTable),
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

      const item = await db.query.tagTypesTable.findFirst({
        where: eq(tagTypesTable.id, id),
      });
      if (!item) {
        set.status = 404;
        return { message: "tag type not found" };
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
        .insert(tagTypesTable)
        .values({
          name: body.name,
          icon: body.icon ?? null,
        })
        .returning();

      set.status = 201;
      return rows[0];
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        icon: t.Optional(t.String()),
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

      if (!body.name && !body.icon) {
        set.status = 400;
        return { message: "no fields to update" };
      }

      const rows = await db
        .update(tagTypesTable)
        .set({
          name: body.name ?? undefined,
          icon: body.icon ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(tagTypesTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "tag type not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        icon: t.Optional(t.String()),
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
        .delete(tagTypesTable)
        .where(eq(tagTypesTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "tag type not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
