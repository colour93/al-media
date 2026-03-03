import { Elysia, t } from "elysia";
import { actorsService } from "../../services/actors";
import { creatorsService } from "../../services/creators";
import { tagsService } from "../../services/tags";
import { fileManager, FileCategory } from "../../services/fileManager";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

const normalizeTagIds = (ids: number[]) => [...new Set(ids)];

function parseForceFlag(raw?: string): boolean {
  if (!raw) return false;
  const val = raw.trim().toLowerCase();
  return val === "1" || val === "true" || val === "yes";
}

export const actorsRoutes = new Elysia({ prefix: "/actors" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return actorsService.findManyPaginated(
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
      return actorsService.searchPaginated(
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
  .post(
    "/merge",
    async ({ body, set }) => {
      if (!Array.isArray(body.sourceIds) || body.sourceIds.length === 0) {
        set.status = 400;
        return { message: "sourceIds 不能为空" };
      }
      const result = await actorsService.merge(body.targetId, body.sourceIds);
      if ("error" in result) {
        const message = result.error ?? "合并演员失败";
        set.status = message.includes("不存在") ? 404 : 400;
        return { message };
      }
      return result;
    },
    {
      body: t.Object({
        targetId: t.Integer(),
        sourceIds: t.Array(t.Integer()),
      }),
    }
  )
  .get(
    "/:id/creators",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      return creatorsService.findCreatorsByActorId(id);
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get(
    "/:id/videos",
    async ({ params, query, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return actorsService.findVideosByActorId(
        id,
        pagination.page,
        pagination.pageSize,
        pagination.offset
      );
    },
    {
      params: t.Object({ id: t.String() }),
      query: paginationQuerySchema,
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
      const item = await actorsService.findByIdWithTags(id);
      if (!item) {
        set.status = 404;
        return { message: "演员不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get(
    "/:id/delete-impact",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const actor = await actorsService.findById(id);
      if (!actor) {
        set.status = 404;
        return { message: "演员不存在" };
      }
      const impact = await actorsService.getDeleteImpact(id);
      return {
        ...impact,
        hasRefs: impact.videoRefs > 0 || impact.creatorRefs > 0 || impact.strategyRefs > 0,
      };
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
    async ({ params, query, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const force = parseForceFlag(query.force);
      const result = await actorsService.delete(id, { force });
      if (result.blocked) {
        set.status = 409;
        return {
          message: "演员存在关联，继续删除将清理关联引用",
          ...result.impact,
          hasRefs: true,
          canForce: true,
        };
      }
      if (result.notFound || !result.item) {
        set.status = 404;
        return { message: "演员不存在" };
      }
      return result.item;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ force: t.Optional(t.String()) }),
    }
  );
