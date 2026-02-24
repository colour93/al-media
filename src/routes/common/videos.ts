import { Elysia, t } from "elysia";
import { videosService } from "../../services/videos";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

export const commonVideosRoutes = new Elysia({ prefix: "/videos" })
  .get(
    "/recommended",
    async () => {
      return videosService.findRecommended();
    }
  )
  .get(
    "/banner",
    async () => {
      return videosService.findBanner();
    }
  )
  .get(
    "/latest",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return videosService.findLatest(
        pagination.page,
        pagination.pageSize,
        pagination.offset
      );
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/",
    async ({ query, set }) => {
      const q = (query as { q?: string }).q?.trim();
      if (q) {
        const parsed = parseSearchQuery(
          { ...query, q } as { q: string; page?: string; pageSize?: string; sortBy?: string; sortOrder?: "asc" | "desc" },
          set
        );
        if (!parsed) return { message: "搜索参数无效" };
        return videosService.searchPaginated(
          parsed.keyword,
          parsed.page,
          parsed.pageSize,
          parsed.offset,
          parsed.sortBy,
          parsed.sortOrder
        );
      }
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
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        q: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const item = await videosService.findById(id, { useCommonUrl: true });
      if (!item) {
        set.status = 404;
        return { message: "视频不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
