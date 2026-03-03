import { Elysia, t } from "elysia";
import { videoFilesService } from "../../services/videoFiles";
import { videoFileManager } from "../../services/videoFileManager";
import { videoFileIndexStrategiesService } from "../../services/videoFileIndexStrategies";
import { videoReencodeManager } from "../../services/videoReencodeManager";
import {
  MAX_PAGE_SIZE,
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

const indexStrategyModeSchema = t.Union([t.Literal("blacklist")]);
const webCompatibilityFilterSchema = t.Union([
  t.Literal("all"),
  t.Literal("compatible"),
  t.Literal("incompatible"),
]);
const hasVideoFilterSchema = t.Union([
  t.Literal("all"),
  t.Literal("bound"),
  t.Literal("unbound"),
]);

function parseWebCompatibilityFilter(raw?: string): "all" | "compatible" | "incompatible" {
  if (raw === "compatible" || raw === "incompatible" || raw === "all") {
    return raw;
  }
  return "all";
}

function parseHasVideoFilter(raw?: string): "all" | "bound" | "unbound" {
  if (raw === "bound" || raw === "unbound" || raw === "all") {
    return raw;
  }
  return "all";
}

function parseFileDirIdFilter(raw?: string): number | null | undefined {
  if (raw == null || raw === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

export const videoFilesRoutes = new Elysia({ prefix: "/video-files" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      const webCompatibility = parseWebCompatibilityFilter(query.webCompatibility);
      const hasVideo = parseHasVideoFilter(query.hasVideo);
      const fileDirId = parseFileDirIdFilter(query.fileDirId);
      if (fileDirId === null) {
        set.status = 400;
        return { message: "fileDirId 无效" };
      }
      return videoFilesService.findManyPaginated(
        pagination.page,
        pagination.pageSize,
        pagination.offset,
        pagination.sortBy,
        pagination.sortOrder,
        { webCompatibility, hasVideo, fileDirId }
      );
    },
    {
      query: t.Object({
        page: t.String({ default: "1" }),
        pageSize: t.String({ default: "10" }),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        webCompatibility: t.Optional(webCompatibilityFilterSchema),
        hasVideo: t.Optional(hasVideoFilterSchema),
        fileDirId: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      const webCompatibility = parseWebCompatibilityFilter(query.webCompatibility);
      const hasVideo = parseHasVideoFilter(query.hasVideo);
      const fileDirId = parseFileDirIdFilter(query.fileDirId);
      if (fileDirId === null) {
        set.status = 400;
        return { message: "fileDirId 无效" };
      }
      return videoFilesService.searchPaginated(
        parsed.keyword,
        parsed.page,
        parsed.pageSize,
        parsed.offset,
        parsed.sortBy,
        parsed.sortOrder,
        { webCompatibility, hasVideo, fileDirId }
      );
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        page: t.String({ default: "1" }),
        pageSize: t.String({ default: "10" }),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        webCompatibility: t.Optional(webCompatibilityFilterSchema),
        hasVideo: t.Optional(hasVideoFilterSchema),
        fileDirId: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/folders/children",
    async ({ query, set }) => {
      const fileDirId = Number(query.fileDirId);
      const pageSize = query.pageSize ? Number(query.pageSize) : 50;
      if (!Number.isInteger(fileDirId) || fileDirId < 1) {
        set.status = 400;
        return { message: "fileDirId 无效" };
      }
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
        set.status = 400;
        return { message: "pageSize 无效" };
      }
      return videoFilesService.listFolderChildren(fileDirId, query.folderPath, query.cursor, pageSize);
    },
    {
      query: t.Object({
        fileDirId: t.String(),
        folderPath: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/folders/files",
    async ({ query, set }) => {
      const fileDirId = Number(query.fileDirId);
      const pageSize = query.pageSize ? Number(query.pageSize) : 50;
      if (!Number.isInteger(fileDirId) || fileDirId < 1) {
        set.status = 400;
        return { message: "fileDirId 无效" };
      }
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
        set.status = 400;
        return { message: "pageSize 无效" };
      }
      return videoFilesService.listFolderFiles(fileDirId, query.folderPath, query.cursor, pageSize);
    },
    {
      query: t.Object({
        fileDirId: t.String(),
        folderPath: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    }
  )
  .get("/scan-task", () => videoFileManager.getScanTaskSnapshot())
  .get("/reencode-task", () => videoReencodeManager.getTaskSnapshot())
  .post(
    "/reencode",
    async ({ body, set }) => {
      const result = await videoReencodeManager.enqueue(body.videoFileId);
      if ("error" in result) {
        set.status = 400;
        return { message: result.error };
      }
      return result;
    },
    {
      body: t.Object({
        videoFileId: t.Integer(),
      }),
    }
  )
  .post(
    "/scan/start",
    async ({ body, set }) => {
      try {
        return await videoFileManager.startScanTaskByDirId(body.fileDirId, { force: body.force ?? false });
      } catch (error) {
        set.status = 400;
        return { message: error instanceof Error ? error.message : "启动索引任务失败" };
      }
    },
    {
      body: t.Object({
        fileDirId: t.Integer(),
        force: t.Optional(t.Boolean()),
      }),
    }
  )
  .post("/scan/pause", () => {
    videoFileManager.pauseScanTask();
    return videoFileManager.getScanTaskSnapshot();
  })
  .post("/scan/resume", () => {
    videoFileManager.resumeScanTask();
    return videoFileManager.getScanTaskSnapshot();
  })
  .post("/scan/stop", () => {
    videoFileManager.stopScanTask();
    return videoFileManager.getScanTaskSnapshot();
  })
  .post("/scan/cancel", () => {
    videoFileManager.cancelScanTask();
    return videoFileManager.getScanTaskSnapshot();
  })
  .get(
    "/index-strategies",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return videoFileIndexStrategiesService.findMany(
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
    "/index-strategies/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      return videoFileIndexStrategiesService.findMany(
        parsed.page,
        parsed.pageSize,
        parsed.offset,
        parsed.sortBy,
        parsed.sortOrder,
        parsed.keyword
      );
    },
    { query: searchQuerySchema }
  )
  .get(
    "/index-strategies/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const item = await videoFileIndexStrategiesService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "索引策略不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/index-strategies",
    async ({ body, set }) => {
      const result = await videoFileIndexStrategiesService.create({
        mode: body.mode,
        fileDirId: body.fileDirId ?? undefined,
        fileKeyRegex: body.fileKeyRegex,
        enabled: body.enabled,
      });
      if ("error" in result) {
        set.status = 400;
        return { message: result.error };
      }
      set.status = 201;
      return result.item;
    },
    {
      body: t.Object({
        mode: t.Optional(indexStrategyModeSchema),
        fileDirId: t.Optional(t.Nullable(t.Integer())),
        fileKeyRegex: t.String({ minLength: 1 }),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .put(
    "/index-strategies/:id",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const result = await videoFileIndexStrategiesService.update(id, {
        mode: body.mode,
        fileDirId: body.fileDirId,
        fileKeyRegex: body.fileKeyRegex,
        enabled: body.enabled,
      });
      if ("error" in result) {
        set.status = result.error === "策略不存在" ? 404 : 400;
        return { message: result.error };
      }
      return result.item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        mode: t.Optional(indexStrategyModeSchema),
        fileDirId: t.Optional(t.Nullable(t.Integer())),
        fileKeyRegex: t.Optional(t.String({ minLength: 1 })),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete(
    "/index-strategies/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const item = await videoFileIndexStrategiesService.delete(id);
      if (!item) {
        set.status = 404;
        return { message: "索引策略不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/index-strategies/:id/apply",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const result = await videoFileIndexStrategiesService.applyStrategy(id);
      if ("error" in result) {
        set.status = result.error === "策略不存在" ? 404 : 400;
        return { message: result.error };
      }
      return result;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const item = await videoFilesService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "视频文件不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
