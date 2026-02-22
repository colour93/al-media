import { Elysia, t } from "elysia";
import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { actorTagsTable } from "../entities/ActorTag";
import { tagsTable } from "../entities/Tag";
import { videoActorsTable } from "../entities/VideoActor";
import { fileManager, FileCategory } from "../services/fileManager";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";

const normalizeTagIds = (tagIds: number[]) => [...new Set(tagIds)];

const hasAllTags = async (tagIds: number[]) => {
  if (tagIds.length === 0) {
    return true;
  }

  const rows = await db.query.tagsTable.findMany({
    where: inArray(tagsTable.id, tagIds),
    columns: { id: true },
  });
  return rows.length === tagIds.length;
};

const toActorResponse = (item: any) => {
  if (!item) {
    return null;
  }

  const { actorTags, ...actor } = item;
  return {
    ...actor,
    tags: actorTags.map((it: any) => it.tag).filter((tag: any) => tag != null),
  };
};

export const actorsRoutes = new Elysia({ prefix: "/actors" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.actorsTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(actorsTable),
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
      const condition = ilike(actorsTable.name, `%${keyword}%`);
      const [items, total] = await Promise.all([
        db.query.actorsTable.findMany({
          where: condition,
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(actorsTable, condition),
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

      const item = await db.query.actorsTable.findFirst({
        where: eq(actorsTable.id, id),
        with: {
          actorTags: {
            with: {
              tag: true,
            },
          },
        },
      });
      if (!item) {
        set.status = 404;
        return { message: "actor not found" };
      }

      return toActorResponse(item);
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
      if (body.avatarKey != null && !fileManager.exists(body.avatarKey, FileCategory.Avatars)) {
        set.status = 400;
        return { message: "avatarKey file not found" };
      }
      const tagIds = normalizeTagIds(body.tags ?? []);
      const allTagsExist = await hasAllTags(tagIds);
      if (!allTagsExist) {
        set.status = 400;
        return { message: "tagId not found" };
      }

      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(actorsTable)
          .values({
            name: body.name,
            avatarKey: body.avatarKey,
          })
          .returning();
        const createdActor = rows[0];
        if (!createdActor) {
          return null;
        }

        if (tagIds.length > 0) {
          await tx.insert(actorTagsTable).values(tagIds.map((tagId) => ({ actorId: createdActor.id, tagId })));
        }

        return tx.query.actorsTable.findFirst({
          where: eq(actorsTable.id, createdActor.id),
          with: {
            actorTags: {
              with: {
                tag: true,
              },
            },
          },
        });
      });

      if (!item) {
        set.status = 500;
        return { message: "failed to create actor" };
      }
      set.status = 201;
      return toActorResponse(item);
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        avatarKey: t.Optional(t.String({ minLength: 1 })),
        tags: t.Optional(t.Array(t.Integer())),
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

      if (!body.name && !body.avatarKey && body.tags === undefined) {
        set.status = 400;
        return { message: "no fields to update" };
      }

      if (body.avatarKey != null && !fileManager.exists(body.avatarKey, FileCategory.Avatars)) {
        set.status = 400;
        return { message: "avatarKey file not found" };
      }

      const tagIds = body.tags === undefined ? undefined : normalizeTagIds(body.tags);
      if (tagIds !== undefined) {
        const allTagsExist = await hasAllTags(tagIds);
        if (!allTagsExist) {
          set.status = 400;
          return { message: "tagId not found" };
        }
      }

      let actorNotFound = false;
      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .update(actorsTable)
          .set({
            name: body.name ?? undefined,
            avatarKey: body.avatarKey ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(actorsTable.id, id))
          .returning();
        const updatedActor = rows[0];
        if (!updatedActor) {
          actorNotFound = true;
          return null;
        }

        if (tagIds !== undefined) {
          await tx.delete(actorTagsTable).where(eq(actorTagsTable.actorId, id));
          if (tagIds.length > 0) {
            await tx.insert(actorTagsTable).values(tagIds.map((tagId) => ({ actorId: id, tagId })));
          }
        }

        return tx.query.actorsTable.findFirst({
          where: eq(actorsTable.id, id),
          with: {
            actorTags: {
              with: {
                tag: true,
              },
            },
          },
        });
      });

      if (!item) {
        if (actorNotFound) {
          set.status = 404;
          return { message: "actor not found" };
        }
        set.status = 500;
        return { message: "failed to update actor" };
      }

      return toActorResponse(item);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        avatarKey: t.Optional(t.String({ minLength: 1 })),
        tags: t.Optional(t.Array(t.Integer())),
      }),
    }
  )
  .patch(
    "/:id/tags",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "invalid id" };
      }

      const tagIds = normalizeTagIds(body.tags);
      const allTagsExist = await hasAllTags(tagIds);
      if (!allTagsExist) {
        set.status = 400;
        return { message: "tagId not found" };
      }

      let actorNotFound = false;
      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .update(actorsTable)
          .set({ updatedAt: new Date() })
          .where(eq(actorsTable.id, id))
          .returning({ id: actorsTable.id });
        const updatedActor = rows[0];
        if (!updatedActor) {
          actorNotFound = true;
          return null;
        }

        await tx.delete(actorTagsTable).where(eq(actorTagsTable.actorId, id));
        if (tagIds.length > 0) {
          await tx.insert(actorTagsTable).values(tagIds.map((tagId) => ({ actorId: id, tagId })));
        }

        return tx.query.actorsTable.findFirst({
          where: eq(actorsTable.id, id),
          with: {
            actorTags: {
              with: {
                tag: true,
              },
            },
          },
        });
      });

      if (!item) {
        if (actorNotFound) {
          set.status = 404;
          return { message: "actor not found" };
        }
        set.status = 500;
        return { message: "failed to update actor tags" };
      }

      return toActorResponse(item);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        tags: t.Array(t.Integer()),
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

      const refs = await db.query.videoActorsTable.findMany({
        where: eq(videoActorsTable.actorId, id),
        limit: 1,
      });
      if (refs.length > 0) {
        set.status = 409;
        return { message: "actor is referenced by videos, cannot delete" };
      }

      const rows = await db
        .delete(actorsTable)
        .where(eq(actorsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "actor not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
