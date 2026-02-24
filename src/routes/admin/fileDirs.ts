import { Elysia, t } from "elysia";
import { fileDirsService } from "../../services/fileDirs";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

export const fileDirsRoutes = new Elysia({ prefix: "/file-dirs" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return fileDirsService.findManyPaginated(pagination.page, pagination.pageSize, pagination.offset);
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      return fileDirsService.searchPaginated(parsed.keyword, parsed.page, parsed.pageSize, parsed.offset);
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
      const item = await fileDirsService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "文件目录不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const item = await fileDirsService.create({ path: body.path, enabled: body.enabled });
      if (!item) {
        set.status = 500;
        return { message: "创建文件目录失败" };
      }
      set.status = 201;
      return item;
    },
    {
      body: t.Object({
        path: t.String({ minLength: 1 }),
        enabled: t.Optional(t.Boolean()),
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
      if (body.enabled === undefined) {
        set.status = 400;
        return { message: "没有可更新的字段" };
      }
      const item = await fileDirsService.update(id, { enabled: body.enabled });
      if (!item) {
        set.status = 404;
        return { message: "文件目录不存在" };
      }
      return item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ enabled: t.Optional(t.Boolean()) }),
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
      const item = await fileDirsService.delete(id);
      if (!item) {
        set.status = 404;
        return { message: "文件目录不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
