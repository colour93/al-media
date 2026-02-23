import { Elysia, t } from "elysia";
import { distributorsService } from "../services/distributors";
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
      if (!pagination) return { message: "分页参数无效" };
      return distributorsService.findManyPaginated(pagination.page, pagination.pageSize, pagination.offset);
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      return distributorsService.searchPaginated(parsed.keyword, parsed.page, parsed.pageSize, parsed.offset);
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
      const item = await distributorsService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "发行商不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const item = await distributorsService.create({ name: body.name, domain: body.domain ?? null });
      if (!item) {
        set.status = 500;
        return { message: "创建发行商失败" };
      }
      set.status = 201;
      return item;
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
        return { message: "ID 无效" };
      }
      if (!body.name && body.domain === undefined) {
        set.status = 400;
        return { message: "没有可更新的字段" };
      }
      const item = await distributorsService.update(id, {
        name: body.name ?? undefined,
        domain: body.domain ?? undefined,
      });
      if (!item) {
        set.status = 404;
        return { message: "发行商不存在" };
      }
      return item;
    },
    {
      params: t.Object({ id: t.String() }),
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
        return { message: "ID 无效" };
      }
      const item = await distributorsService.delete(id);
      if (!item) {
        set.status = 404;
        return { message: "发行商不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
