import { Elysia, t } from "elysia";
import { fileManager, FileCategory } from "../../services/fileManager";
import { videoFilesService } from "../../services/videoFiles";
import { videosService } from "../../services/videos";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

export const videosRoutes = new Elysia({ prefix: "/videos" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return videosService.findManyPaginated(
        pagination.page,
        pagination.pageSize,
        pagination.offset,
        pagination.sortBy,
        pagination.sortOrder
      );
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      return videosService.searchPaginated(
        parsed.keyword,
        parsed.page,
        parsed.pageSize,
        parsed.offset,
        parsed.sortBy,
        parsed.sortOrder
      );
    },
    { query: searchQuerySchema }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const item = await videosService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "视频不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const key = body.thumbnailKey ?? null;
      if (key != null && key !== "" && !fileManager.exists(key, FileCategory.Thumbnails)) {
        set.status = 400;
        return { message: "缩略图文件不存在" };
      }
      const result = await videosService.create({
        title: body.title,
        thumbnailKey: key,
        actors: body.actors,
        creators: body.creators,
        distributors: body.distributors,
        tags: body.tags,
      });
      if ("error" in result) {
        set.status = 400;
        return { message: result.error };
      }
      if (!result.item) {
        set.status = 500;
        return { message: "创建视频失败" };
      }
      set.status = 201;
      return result.item;
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
        return { message: "ID 无效" };
      }
      if (
        !body.title &&
        body.thumbnailKey === undefined &&
        body.actors === undefined &&
        body.creators === undefined &&
        body.distributors === undefined &&
        body.tags === undefined &&
        body.isFeatured === undefined &&
        body.isBanner === undefined &&
        body.bannerOrder === undefined &&
        body.recommendedOrder === undefined
      ) {
        set.status = 400;
        return { message: "没有可更新的字段" };
      }
      if (
        body.thumbnailKey != null &&
        body.thumbnailKey !== "" &&
        !fileManager.exists(body.thumbnailKey, FileCategory.Thumbnails)
      ) {
        set.status = 400;
        return { message: "缩略图文件不存在" };
      }
      const result = await videosService.update(id, {
        title: body.title ?? undefined,
        thumbnailKey: body.thumbnailKey ?? undefined,
        actors: body.actors,
        creators: body.creators,
        distributors: body.distributors,
        tags: body.tags,
        isFeatured: body.isFeatured,
        isBanner: body.isBanner,
        bannerOrder: body.bannerOrder,
        recommendedOrder: body.recommendedOrder,
      });
      if ("error" in result) {
        set.status = result.error === "视频不存在" ? 404 : 400;
        return { message: result.error };
      }
      return result.item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        thumbnailKey: t.Optional(t.String()),
        actors: t.Optional(t.Array(t.Integer())),
        creators: t.Optional(t.Array(t.Integer())),
        distributors: t.Optional(t.Array(t.Integer())),
        tags: t.Optional(t.Array(t.Integer())),
        isFeatured: t.Optional(t.Boolean()),
        isBanner: t.Optional(t.Boolean()),
        bannerOrder: t.Optional(t.Nullable(t.Integer())),
        recommendedOrder: t.Optional(t.Nullable(t.Integer())),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const item = await videosService.delete(id);
      if (!item) {
        set.status = 404;
        return { message: "视频不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/batch-add-tags",
    async ({ body, set }) => {
      const videoIds = body.videoIds ?? [];
      const tagIds = body.tagIds ?? [];
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        set.status = 400;
        return { message: "videoIds 不能为空" };
      }
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        set.status = 400;
        return { message: "tagIds 不能为空" };
      }
      const result = await videosService.batchAddTags(videoIds, tagIds);
      return result;
    },
    {
      body: t.Object({
        videoIds: t.Array(t.Integer()),
        tagIds: t.Array(t.Integer()),
      }),
    }
  )
  .post(
    "/batch-add-actors",
    async ({ body, set }) => {
      const videoIds = body.videoIds ?? [];
      const actorIds = body.actorIds ?? [];
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        set.status = 400;
        return { message: "videoIds 不能为空" };
      }
      if (!Array.isArray(actorIds) || actorIds.length === 0) {
        set.status = 400;
        return { message: "actorIds 不能为空" };
      }
      return videosService.batchAddActors(videoIds, actorIds);
    },
    {
      body: t.Object({
        videoIds: t.Array(t.Integer()),
        actorIds: t.Array(t.Integer()),
      }),
    }
  )
  .post(
    "/batch-add-creators",
    async ({ body, set }) => {
      const videoIds = body.videoIds ?? [];
      const creatorIds = body.creatorIds ?? [];
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        set.status = 400;
        return { message: "videoIds 不能为空" };
      }
      if (!Array.isArray(creatorIds) || creatorIds.length === 0) {
        set.status = 400;
        return { message: "creatorIds 不能为空" };
      }
      return videosService.batchAddCreators(videoIds, creatorIds);
    },
    {
      body: t.Object({
        videoIds: t.Array(t.Integer()),
        creatorIds: t.Array(t.Integer()),
      }),
    }
  )
  .post(
    "/insert-from-video-file",
    async ({ body, set }) => {
      const videoFileId = Number(body.videoFileId);
      if (!Number.isInteger(videoFileId)) {
        set.status = 400;
        return { message: "视频文件 ID 无效" };
      }
      const videoFile = await videoFilesService.findByIdRaw(videoFileId);
      if (!videoFile) {
        set.status = 404;
        return { message: "视频文件不存在" };
      }
      const autoExtract = body.autoExtract ?? true;
      const item = await videosService.insertVideoFromVideoFile(videoFile, { autoExtract });
      if (!item) {
        set.status = 500;
        return { message: "插入视频失败" };
      }
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
    "/:id/capture-thumbnail",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const result = await videosService.captureThumbnail(id, body.seekSec);
      if ("error" in result) {
        set.status = 400;
        return { message: result.error };
      }
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ seekSec: t.Optional(t.Number()) }),
    }
  )
  .post(
    "/:id/re-extract",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const video = await videosService.findById(id);
      if (!video) {
        set.status = 404;
        return { message: "视频不存在" };
      }
      const result = await videosService.reExtractVideoInfo(id);
      if (!result) {
        set.status = 400;
        return { message: "视频没有关联的视频文件可供提取" };
      }
      const item = await videosService.findById(id);
      return item!;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/infer-video-info",
    async ({ body, set }) => {
      const filename = body.filename;
      if (!filename) {
        set.status = 400;
        return { message: "文件名必填" };
      }
      const info = await videosService.inferVideoInfo(filename);
      return info;
    },
    {
      body: t.Object({
        filename: t.String(),
      }),
    }
  );
