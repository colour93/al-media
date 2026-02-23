import { Elysia, t } from "elysia";
import { tagsService } from "../services/tags";
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
      if (!pagination) return { message: "分页参数无效" };
      return tagsService.findManyPaginated(pagination.page, pagination.pageSize, pagination.offset);
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      return tagsService.searchPaginated(parsed.keyword, parsed.page, parsed.pageSize, parsed.offset);
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
      const item = await tagsService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "标签不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const item = await tagsService.create({
        name: body.name,
        tagTypeId: body.tagTypeId,
        color: body.color ?? null,
      });
      if (!item) {
        set.status = 500;
        return { message: "创建标签失败" };
      }
      set.status = 201;
      return item;
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
        return { message: "ID 无效" };
      }
      if (!body.name && body.tagTypeId === undefined && !body.color) {
        set.status = 400;
        return { message: "没有可更新的字段" };
      }
      const item = await tagsService.update(id, {
        name: body.name ?? undefined,
        tagTypeId: body.tagTypeId ?? undefined,
        color: body.color ?? undefined,
      });
      if (!item) {
        set.status = 404;
        return { message: "标签不存在" };
      }
      return item;
    },
    {
      params: t.Object({ id: t.String() }),
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
        return { message: "ID 无效" };
      }
      const item = await tagsService.delete(id);
      if (!item) {
        set.status = 404;
        return { message: "标签不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
