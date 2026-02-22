import { Elysia, t } from "elysia";
import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { creatorsTable } from "../entities/Creator";
import { creatorTagsTable } from "../entities/CreatorTag";
import { tagsTable } from "../entities/Tag";
import { videoCreatorsTable } from "../entities/VideoCreator";
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

const hasActor = async (actorId: number) => {
  const item = await db.query.actorsTable.findFirst({
    where: eq(actorsTable.id, actorId),
    columns: { id: true },
  });
  return !!item;
};

const toCreatorResponse = (item: any) => {
  if (!item) {
    return null;
  }

  const { creatorTags, ...creator } = item;
  return {
    ...creator,
    tags: creatorTags.map((it: any) => it.tag).filter((tag: any) => tag != null),
  };
};

export const creatorsRoutes = new Elysia({ prefix: "/creators" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.creatorsTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(creatorsTable),
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
      const condition = ilike(creatorsTable.name, `%${keyword}%`);
      const [items, total] = await Promise.all([
        db.query.creatorsTable.findMany({
          where: condition,
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
        }),
        db.$count(creatorsTable, condition),
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

      const item = await db.query.creatorsTable.findFirst({
        where: eq(creatorsTable.id, id),
        with: {
          actor: true,
          creatorTags: {
            with: {
              tag: true,
            },
          },
        },
      });
      if (!item) {
        set.status = 404;
        return { message: "creator not found" };
      }

      return toCreatorResponse(item);
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
      if (body.actorId !== undefined && body.actorId !== null) {
        const actorExists = await hasActor(body.actorId);
        if (!actorExists) {
          set.status = 400;
          return { message: "actorId not found" };
        }
      }

      const tagIds = normalizeTagIds(body.tags ?? []);
      const allTagsExist = await hasAllTags(tagIds);
      if (!allTagsExist) {
        set.status = 400;
        return { message: "tagId not found" };
      }

      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(creatorsTable)
          .values({
            name: body.name,
            type: body.type,
            actorId: body.actorId ?? null,
            platform: body.platform ?? null,
            platformId: body.platformId ?? null,
          })
          .returning();
        const created = rows[0];
        if (!created) {
          return null;
        }

        if (tagIds.length > 0) {
          await tx.insert(creatorTagsTable).values(tagIds.map((tagId) => ({ creatorId: created.id, tagId })));
        }

        return tx.query.creatorsTable.findFirst({
          where: eq(creatorsTable.id, created.id),
          with: {
            actor: true,
            creatorTags: {
              with: {
                tag: true,
              },
            },
          },
        });
      });

      if (!item) {
        set.status = 500;
        return { message: "failed to create creator" };
      }

      set.status = 201;
      return toCreatorResponse(item);
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        type: t.Union([t.Literal("person"), t.Literal("group")]),
        actorId: t.Optional(t.Nullable(t.Integer())),
        platform: t.Optional(
          t.Nullable(
            t.Union([
              t.Literal("onlyfans"),
              t.Literal("justforfans"),
              t.Literal("fansone"),
              t.Literal("fansonly"),
            ])
          )
        ),
        platformId: t.Optional(t.Nullable(t.String())),
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

      if (
        !body.name &&
        body.type === undefined &&
        body.actorId === undefined &&
        body.platform === undefined &&
        body.platformId === undefined &&
        body.tags === undefined
      ) {
        set.status = 400;
        return { message: "no fields to update" };
      }

      if (body.actorId !== undefined && body.actorId !== null) {
        const actorExists = await hasActor(body.actorId);
        if (!actorExists) {
          set.status = 400;
          return { message: "actorId not found" };
        }
      }

      const tagIds = body.tags === undefined ? undefined : normalizeTagIds(body.tags);
      if (tagIds !== undefined) {
        const allTagsExist = await hasAllTags(tagIds);
        if (!allTagsExist) {
          set.status = 400;
          return { message: "tagId not found" };
        }
      }

      let creatorNotFound = false;
      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .update(creatorsTable)
          .set({
            name: body.name ?? undefined,
            type: body.type ?? undefined,
            actorId: body.actorId !== undefined ? body.actorId : undefined,
            platform: body.platform !== undefined ? body.platform : undefined,
            platformId: body.platformId !== undefined ? body.platformId : undefined,
            updatedAt: new Date(),
          })
          .where(eq(creatorsTable.id, id))
          .returning();
        const updated = rows[0];
        if (!updated) {
          creatorNotFound = true;
          return null;
        }

        if (tagIds !== undefined) {
          await tx.delete(creatorTagsTable).where(eq(creatorTagsTable.creatorId, id));
          if (tagIds.length > 0) {
            await tx.insert(creatorTagsTable).values(tagIds.map((tagId) => ({ creatorId: id, tagId })));
          }
        }

        return tx.query.creatorsTable.findFirst({
          where: eq(creatorsTable.id, id),
          with: {
            actor: true,
            creatorTags: {
              with: {
                tag: true,
              },
            },
          },
        });
      });

      if (!item) {
        if (creatorNotFound) {
          set.status = 404;
          return { message: "creator not found" };
        }
        set.status = 500;
        return { message: "failed to update creator" };
      }

      return toCreatorResponse(item);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        type: t.Optional(t.Union([t.Literal("person"), t.Literal("group")])),
        actorId: t.Optional(t.Nullable(t.Integer())),
        platform: t.Optional(
          t.Nullable(
            t.Union([
              t.Literal("onlyfans"),
              t.Literal("justforfans"),
              t.Literal("fansone"),
              t.Literal("fansonly"),
            ])
          )
        ),
        platformId: t.Optional(t.Nullable(t.String())),
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

      let creatorNotFound = false;
      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .update(creatorsTable)
          .set({ updatedAt: new Date() })
          .where(eq(creatorsTable.id, id))
          .returning({ id: creatorsTable.id });
        if (!rows[0]) {
          creatorNotFound = true;
          return null;
        }

        await tx.delete(creatorTagsTable).where(eq(creatorTagsTable.creatorId, id));
        if (tagIds.length > 0) {
          await tx.insert(creatorTagsTable).values(tagIds.map((tagId) => ({ creatorId: id, tagId })));
        }

        return tx.query.creatorsTable.findFirst({
          where: eq(creatorsTable.id, id),
          with: {
            actor: true,
            creatorTags: {
              with: {
                tag: true,
              },
            },
          },
        });
      });

      if (!item) {
        if (creatorNotFound) {
          set.status = 404;
          return { message: "creator not found" };
        }
        set.status = 500;
        return { message: "failed to update creator tags" };
      }

      return toCreatorResponse(item);
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

      const refs = await db.query.videoCreatorsTable.findMany({
        where: eq(videoCreatorsTable.creatorId, id),
        limit: 1,
      });
      if (refs.length > 0) {
        set.status = 409;
        return { message: "creator is referenced by videos, cannot delete" };
      }

      const rows = await db
        .delete(creatorsTable)
        .where(eq(creatorsTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "creator not found" };
      }

      return item;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
