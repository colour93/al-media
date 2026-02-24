import { Elysia, t } from "elysia";
import { tagTypesService } from "../../services/tagTypes";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

export const tagTypesRoutes = new Elysia({ prefix: "/tag-types" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return tagTypesService.findManyPaginated(pagination.page, pagination.pageSize, pagination.offset);
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      return tagTypesService.searchPaginated(parsed.keyword, parsed.page, parsed.pageSize, parsed.offset);
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
      const item = await tagTypesService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "标签类型不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const item = await tagTypesService.create({ name: body.name, icon: body.icon ?? null });
      if (!item) {
        set.status = 500;
        return { message: "创建标签类型失败" };
      }
      set.status = 201;
      return item;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        icon: t.Optional(t.String()),
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
      if (!body.name && !body.icon) {
        set.status = 400;
        return { message: "没有可更新的字段" };
      }
      const item = await tagTypesService.update(id, {
        name: body.name ?? undefined,
        icon: body.icon ?? undefined,
      });
      if (!item) {
        set.status = 404;
        return { message: "标签类型不存在" };
      }
      return item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        icon: t.Optional(t.String()),
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
      const item = await tagTypesService.delete(id);
      if (!item) {
        set.status = 404;
        return { message: "标签类型不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
