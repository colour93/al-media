import { Elysia, t } from "elysia";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "../db";
import { distributorsTable } from "../entities/Distributor";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";

export const distributorsRoutes = new Elysia({ prefix: "/distributors" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.distributorsTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(distributorsTable),
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

      const item = await db.query.distributorsTable.findFirst({
        where: eq(distributorsTable.id, id),
      });
      if (!item) {
        set.status = 404;
        return { message: "distributor not found" };
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
        .insert(distributorsTable)
        .values({
          name: body.name,
          domain: body.domain ?? null,
        })
        .returning();

      set.status = 201;
      return rows[0];
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        domain: t.Optional(t.String()),
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

      if (!body.name && body.domain === undefined) {
        set.status = 400;
        return { message: "no fields to update" };
      }

      const rows = await db
        .update(distributorsTable)
        .set({
          name: body.name ?? undefined,
          domain: body.domain ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(distributorsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "distributor not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        domain: t.Optional(t.String()),
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
        .delete(distributorsTable)
        .where(eq(distributorsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "distributor not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
