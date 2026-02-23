import { Elysia, t } from "elysia";
import { actorsService } from "../services/actors";
import { tagsService } from "../services/tags";
import { fileManager, FileCategory } from "../services/fileManager";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../utils/pagination";

const normalizeTagIds = (ids: number[]) => [...new Set(ids)];

export const actorsRoutes = new Elysia({ prefix: "/actors" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return actorsService.findManyPaginated(pagination.page, pagination.pageSize, pagination.offset);
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/search",
    async ({ query, set }) => {
      const parsed = parseSearchQuery(query, set);
      if (!parsed) return { message: "搜索参数无效" };
      return actorsService.searchPaginated(parsed.keyword, parsed.page, parsed.pageSize, parsed.offset);
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
      const item = await actorsService.findByIdWithTags(id);
      if (!item) {
        set.status = 404;
        return { message: "演员不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      if (body.avatarKey != null && !fileManager.exists(body.avatarKey, FileCategory.Avatars)) {
        set.status = 400;
        return { message: "头像文件不存在" };
      }
      const tagIds = normalizeTagIds(body.tags ?? []);
      const allTagsExist = await tagsService.idsExist(tagIds);
      if (!allTagsExist) {
        set.status = 400;
        return { message: "标签 ID 不存在" };
      }
      const item = await actorsService.create(
        { name: body.name, avatarKey: body.avatarKey ?? null },
        tagIds
      );
      if (!item) {
        set.status = 500;
        return { message: "创建演员失败" };
      }
      set.status = 201;
      return item;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        avatarKey: t.Optional(t.String({ minLength: 1 })),
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
      if (!body.name && !body.avatarKey && body.tags === undefined) {
        set.status = 400;
        return { message: "没有可更新的字段" };
      }
      if (body.avatarKey != null && !fileManager.exists(body.avatarKey, FileCategory.Avatars)) {
        set.status = 400;
        return { message: "头像文件不存在" };
      }
      const tagIds = body.tags === undefined ? undefined : normalizeTagIds(body.tags);
      if (tagIds !== undefined) {
        const allTagsExist = await tagsService.idsExist(tagIds);
        if (!allTagsExist) {
          set.status = 400;
          return { message: "标签 ID 不存在" };
        }
      }
      const { item, actorNotFound } = await actorsService.update(
        id,
        {
          name: body.name ?? undefined,
          avatarKey: body.avatarKey ?? undefined,
        },
        tagIds
      );
      if (!item) {
        set.status = actorNotFound ? 404 : 500;
        return { message: actorNotFound ? "演员不存在" : "更新演员失败" };
      }
      return item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        avatarKey: t.Optional(t.String({ minLength: 1 })),
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
        return { message: "ID 无效" };
      }
      const tagIds = normalizeTagIds(body.tags);
      const allTagsExist = await tagsService.idsExist(tagIds);
      if (!allTagsExist) {
        set.status = 400;
        return { message: "标签 ID 不存在" };
      }
      const { item, actorNotFound } = await actorsService.updateTagsOnly(id, tagIds);
      if (!item) {
        set.status = actorNotFound ? 404 : 500;
        return { message: actorNotFound ? "演员不存在" : "更新演员标签失败" };
      }
      return item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ tags: t.Array(t.Integer()) }),
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
      const { item, hasRefs } = await actorsService.delete(id);
      if (hasRefs) {
        set.status = 409;
        return { message: "演员被视频引用，无法删除" };
      }
      if (!item) {
        set.status = 404;
        return { message: "演员不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  );
