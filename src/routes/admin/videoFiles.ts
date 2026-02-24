import { Elysia, t } from "elysia";
import { videoFilesService } from "../../services/videoFiles";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

export const videoFilesRoutes = new Elysia({ prefix: "/video-files" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return videoFilesService.findManyPaginated(
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
      return videoFilesService.searchPaginated(
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
      const item = await videoFilesService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "视频文件不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
