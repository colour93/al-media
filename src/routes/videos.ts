import { Elysia, t } from "elysia";
import { eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import { actorsTable } from "../entities/Actor";
import { creatorsTable } from "../entities/Creator";
import { distributorsTable } from "../entities/Distributor";
import { tagsTable } from "../entities/Tag";
import { videosTable } from "../entities/Video";
import { videoActorsTable } from "../entities/VideoActor";
import { videoCreatorsTable } from "../entities/VideoCreator";
import { videoDistributorsTable } from "../entities/VideoDistributor";
import { videoTagsTable } from "../entities/VideoTag";
import { fileManager, FileCategory } from "../services/fileManager";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";
import { videoFilesTable } from "../entities/VideoFile";
import { videosService } from "../services/videos";

const normalizeIds = (ids: number[]) => [...new Set(ids)];

const hasAllActors = async (ids: number[]) => {
  if (ids.length === 0) {
    return true;
  }
  const rows = await db.query.actorsTable.findMany({
    where: inArray(actorsTable.id, ids),
    columns: { id: true },
  });
  return rows.length === ids.length;
};

const hasAllCreators = async (ids: number[]) => {
  if (ids.length === 0) {
    return true;
  }
  const rows = await db.query.creatorsTable.findMany({
    where: inArray(creatorsTable.id, ids),
    columns: { id: true },
  });
  return rows.length === ids.length;
};

const hasAllDistributors = async (ids: number[]) => {
  if (ids.length === 0) {
    return true;
  }
  const rows = await db.query.distributorsTable.findMany({
    where: inArray(distributorsTable.id, ids),
    columns: { id: true },
  });
  return rows.length === ids.length;
};

const hasAllTags = async (ids: number[]) => {
  if (ids.length === 0) {
    return true;
  }
  const rows = await db.query.tagsTable.findMany({
    where: inArray(tagsTable.id, ids),
    columns: { id: true },
  });
  return rows.length === ids.length;
};

const toVideoResponse = (item: any) => {
  if (!item) {
    return null;
  }

  const { videoActors, videoCreators, videoDistributors, videoTags, ...video } = item;
  return {
    ...video,
    actors: videoActors.map((it: any) => it.actor).filter((actor: any) => actor != null),
    creators: videoCreators
      .map((it: any) => it.creator)
      .filter((creator: any) => creator != null),
    distributors: videoDistributors
      .map((it: any) => it.distributor)
      .filter((distributor: any) => distributor != null),
    tags: videoTags.map((it: any) => it.tag).filter((tag: any) => tag != null),
  };
};

const videoWithRelations = {
  videoActors: { with: { actor: true } },
  videoCreators: { with: { creator: { with: { actor: true } } } },
  videoDistributors: { with: { distributor: true } },
  videoTags: { with: { tag: true } },
} as const;

const getVideoWithRelations = (id: number) =>
  db.query.videosTable.findFirst({
    where: eq(videosTable.id, id),
    with: videoWithRelations,
  });

export const videosRoutes = new Elysia({ prefix: "/videos" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) {
        return { message: "invalid pagination" };
      }

      const { page, pageSize, offset } = pagination;
      const [items, total] = await Promise.all([
        db.query.videosTable.findMany({
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
          with: {
            videoUniqueContents: {
              with: {
                video: true
              }
            },
            ...videoWithRelations,
          },
        }),
        db.$count(videosTable),
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
      const condition = ilike(videosTable.title, `%${keyword}%`);
      const [items, total] = await Promise.all([
        db.query.videosTable.findMany({
          where: condition,
          orderBy: (t, { desc }) => [desc(t.id)],
          limit: pageSize,
          offset,
          with: videoWithRelations,
        }),
        db.$count(videosTable, condition),
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

      const item = await getVideoWithRelations(id);
      if (!item) {
        set.status = 404;
        return { message: "video not found" };
      }

      return toVideoResponse(item);
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
      const key = body.thumbnailKey ?? null;
      if (key != null && key !== "" && !fileManager.exists(key, FileCategory.Thumbnails)) {
        set.status = 400;
        return { message: "thumbnailKey file not found" };
      }

      const actorIds = normalizeIds(body.actors ?? []);
      const creatorIds = normalizeIds(body.creators ?? []);
      const distributorIds = normalizeIds(body.distributors ?? []);
      const tagIds = normalizeIds(body.tags ?? []);

      const [allActors, allCreators, allDistributors, allTags] = await Promise.all([
        hasAllActors(actorIds),
        hasAllCreators(creatorIds),
        hasAllDistributors(distributorIds),
        hasAllTags(tagIds),
      ]);
      if (!allActors) {
        set.status = 400;
        return { message: "actorId not found" };
      }
      if (!allCreators) {
        set.status = 400;
        return { message: "creatorId not found" };
      }
      if (!allDistributors) {
        set.status = 400;
        return { message: "distributorId not found" };
      }
      if (!allTags) {
        set.status = 400;
        return { message: "tagId not found" };
      }

      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(videosTable)
          .values({
            title: body.title,
            thumbnailKey: key,
          })
          .returning();
        const created = rows[0];
        if (!created) {
          return null;
        }

        if (actorIds.length > 0) {
          await tx.insert(videoActorsTable).values(actorIds.map((actorId) => ({ videoId: created.id, actorId })));
        }
        if (creatorIds.length > 0) {
          await tx
            .insert(videoCreatorsTable)
            .values(creatorIds.map((creatorId) => ({ videoId: created.id, creatorId })));
        }
        if (distributorIds.length > 0) {
          await tx
            .insert(videoDistributorsTable)
            .values(distributorIds.map((distributorId) => ({ videoId: created.id, distributorId })));
        }
        if (tagIds.length > 0) {
          await tx.insert(videoTagsTable).values(tagIds.map((tagId) => ({ videoId: created.id, tagId })));
        }

        return tx.query.videosTable.findFirst({
          where: eq(videosTable.id, created.id),
          with: videoWithRelations,
        });
      });

      if (!item) {
        set.status = 500;
        return { message: "failed to create video" };
      }

      set.status = 201;
      return toVideoResponse(item);
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        thumbnailKey: t.Optional(t.String()),
        actors: t.Optional(t.Array(t.Integer())),
        creators: t.Optional(t.Array(t.Integer())),
        distributors: t.Optional(t.Array(t.Integer())),
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
        !body.title &&
        body.thumbnailKey === undefined &&
        body.actors === undefined &&
        body.creators === undefined &&
        body.distributors === undefined &&
        body.tags === undefined
      ) {
        set.status = 400;
        return { message: "no fields to update" };
      }

      if (
        body.thumbnailKey != null &&
        body.thumbnailKey !== "" &&
        !fileManager.exists(body.thumbnailKey, FileCategory.Thumbnails)
      ) {
        set.status = 400;
        return { message: "thumbnailKey file not found" };
      }

      const actorIds = body.actors === undefined ? undefined : normalizeIds(body.actors);
      const creatorIds = body.creators === undefined ? undefined : normalizeIds(body.creators);
      const distributorIds = body.distributors === undefined ? undefined : normalizeIds(body.distributors);
      const tagIds = body.tags === undefined ? undefined : normalizeIds(body.tags);

      const checks = await Promise.all([
        actorIds === undefined ? true : hasAllActors(actorIds),
        creatorIds === undefined ? true : hasAllCreators(creatorIds),
        distributorIds === undefined ? true : hasAllDistributors(distributorIds),
        tagIds === undefined ? true : hasAllTags(tagIds),
      ]);
      if (!checks[0]) {
        set.status = 400;
        return { message: "actorId not found" };
      }
      if (!checks[1]) {
        set.status = 400;
        return { message: "creatorId not found" };
      }
      if (!checks[2]) {
        set.status = 400;
        return { message: "distributorId not found" };
      }
      if (!checks[3]) {
        set.status = 400;
        return { message: "tagId not found" };
      }

      let videoNotFound = false;
      const item = await db.transaction(async (tx) => {
        const rows = await tx
          .update(videosTable)
          .set({
            title: body.title ?? undefined,
            thumbnailKey: body.thumbnailKey ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(videosTable.id, id))
          .returning();
        if (!rows[0]) {
          videoNotFound = true;
          return null;
        }

        if (actorIds !== undefined) {
          await tx.delete(videoActorsTable).where(eq(videoActorsTable.videoId, id));
          if (actorIds.length > 0) {
            await tx.insert(videoActorsTable).values(actorIds.map((actorId) => ({ videoId: id, actorId })));
          }
        }
        if (creatorIds !== undefined) {
          await tx.delete(videoCreatorsTable).where(eq(videoCreatorsTable.videoId, id));
          if (creatorIds.length > 0) {
            await tx.insert(videoCreatorsTable).values(creatorIds.map((creatorId) => ({ videoId: id, creatorId })));
          }
        }
        if (distributorIds !== undefined) {
          await tx.delete(videoDistributorsTable).where(eq(videoDistributorsTable.videoId, id));
          if (distributorIds.length > 0) {
            await tx
              .insert(videoDistributorsTable)
              .values(distributorIds.map((distributorId) => ({ videoId: id, distributorId })));
          }
        }
        if (tagIds !== undefined) {
          await tx.delete(videoTagsTable).where(eq(videoTagsTable.videoId, id));
          if (tagIds.length > 0) {
            await tx.insert(videoTagsTable).values(tagIds.map((tagId) => ({ videoId: id, tagId })));
          }
        }

        return tx.query.videosTable.findFirst({
          where: eq(videosTable.id, id),
          with: videoWithRelations,
        });
      });

      if (!item) {
        if (videoNotFound) {
          set.status = 404;
          return { message: "video not found" };
        }
        set.status = 500;
        return { message: "failed to update video" };
      }

      return toVideoResponse(item);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        thumbnailKey: t.Optional(t.String()),
        actors: t.Optional(t.Array(t.Integer())),
        creators: t.Optional(t.Array(t.Integer())),
        distributors: t.Optional(t.Array(t.Integer())),
        tags: t.Optional(t.Array(t.Integer())),
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
        .delete(videosTable)
        .where(eq(videosTable.id, id))
        .returning();

      const item = rows[0];
      if (!item) {
        set.status = 404;
        return { message: "video not found" };
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
    "/insert-from-video-file",
    async ({ body, set }) => {
      const videoFileId = Number(body.videoFileId);
      if (!Number.isInteger(videoFileId)) {
        set.status = 400;
        return { message: "invalid video file id" };
      }
      const videoFile = await db.query.videoFilesTable.findFirst({
        where: eq(videoFilesTable.id, videoFileId),
      });
      if (!videoFile) {
        set.status = 404;
        return { message: "video file not found" };
      }
      const autoExtract = body.autoExtract ?? true;
      const item = await videosService.insertVideoFromVideoFile(videoFile, {
        autoExtract,
      });
      return item;
    },
    {
      body: t.Object({
        videoFileId: t.Integer(),
        autoExtract: t.Optional(t.Boolean()),
      }),
    }
  )
  .post(
    "/:id/re-extract",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "invalid id" };
      }

      const video = await db.query.videosTable.findFirst({
        where: eq(videosTable.id, id),
        columns: { id: true },
      });
      if (!video) {
        set.status = 404;
        return { message: "video not found" };
      }

      const result = await videosService.reExtractVideoInfo(id);
      if (!result) {
        set.status = 400;
        return { message: "video has no linked video file to extract from" };
      }

      const item = await getVideoWithRelations(id);
      return toVideoResponse(item!);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
  .post(
    "/infer-video-info",
    async ({ body, set }) => {
      const filename = body.filename;
      if (!filename) {
        set.status = 400;
        return { message: "filename is required" };
      }
      const info = await videosService.inferVideoInfo(filename);
      return info;
    },
    {
      body: t.Object({
        filename: t.String(),
      }),
    }
  )
