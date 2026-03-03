import { Elysia, t } from "elysia";
import { creatorsService } from "../../services/creators";
import { tagsService } from "../../services/tags";
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

const creatorPlatformUnion = t.Union([
  t.Literal("onlyfans"),
  t.Literal("justforfans"),
  t.Literal("fansone"),
  t.Literal("fansonly"),
]);

export const creatorsRoutes = new Elysia({ prefix: "/creators" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return creatorsService.findManyPaginated(
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
      return creatorsService.searchPaginated(
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
      const result = await creatorsService.merge(body.targetId, body.sourceIds);
      if ("error" in result) {
        const message = result.error ?? "合并创作者失败";
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
    "/:id/videos",
    async ({ params, query, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return creatorsService.findVideosByCreatorId(
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
      const item = await creatorsService.findByIdWithTags(id);
      if (!item) {
        set.status = 404;
        return { message: "创作者不存在" };
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
      const creator = await creatorsService.findById(id);
      if (!creator) {
        set.status = 404;
        return { message: "创作者不存在" };
      }
      const impact = await creatorsService.getDeleteImpact(id);
      return {
        ...impact,
        hasRefs: impact.videoRefs > 0 || impact.strategyRefs > 0,
      };
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      if (body.actorId !== undefined && body.actorId !== null) {
        const actorExists = await creatorsService.actorExists(body.actorId);
        if (!actorExists) {
          set.status = 400;
          return { message: "演员 ID 不存在" };
        }
      }
      const tagIds = normalizeTagIds(body.tags ?? []);
      const allTagsExist = await tagsService.idsExist(tagIds);
      if (!allTagsExist) {
        set.status = 400;
        return { message: "标签 ID 不存在" };
      }
      const item = await creatorsService.create(
        {
          name: body.name,
          type: body.type,
          actorId: body.actorId ?? null,
          platform: body.platform ?? null,
          platformId: body.platformId ?? null,
        },
        tagIds
      );
      if (!item) {
        set.status = 500;
        return { message: "创建创作者失败" };
      }
      set.status = 201;
      return item;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        type: t.Union([t.Literal("person"), t.Literal("group")]),
        actorId: t.Optional(t.Nullable(t.Integer())),
        platform: t.Optional(t.Nullable(creatorPlatformUnion)),
        platformId: t.Optional(t.Nullable(t.String())),
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
        !body.name &&
        body.type === undefined &&
        body.actorId === undefined &&
        body.platform === undefined &&
        body.platformId === undefined &&
        body.tags === undefined
      ) {
        set.status = 400;
        return { message: "没有可更新的字段" };
      }
      if (body.actorId !== undefined && body.actorId !== null) {
        const actorExists = await creatorsService.actorExists(body.actorId);
        if (!actorExists) {
          set.status = 400;
          return { message: "演员 ID 不存在" };
        }
      }
      const tagIds = body.tags === undefined ? undefined : normalizeTagIds(body.tags);
      if (tagIds !== undefined) {
        const allTagsExist = await tagsService.idsExist(tagIds);
        if (!allTagsExist) {
          set.status = 400;
          return { message: "标签 ID 不存在" };
        }
      }
      const { item, creatorNotFound } = await creatorsService.update(
        id,
        {
          name: body.name ?? undefined,
          type: body.type ?? undefined,
          actorId: body.actorId !== undefined ? body.actorId : undefined,
          platform: body.platform !== undefined ? body.platform : undefined,
          platformId: body.platformId !== undefined ? body.platformId : undefined,
        },
        tagIds
      );
      if (!item) {
        set.status = creatorNotFound ? 404 : 500;
        return { message: creatorNotFound ? "创作者不存在" : "更新创作者失败" };
      }
      return item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        type: t.Optional(t.Union([t.Literal("person"), t.Literal("group")])),
        actorId: t.Optional(t.Nullable(t.Integer())),
        platform: t.Optional(t.Nullable(creatorPlatformUnion)),
        platformId: t.Optional(t.Nullable(t.String())),
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
      const { item, creatorNotFound } = await creatorsService.updateTagsOnly(id, tagIds);
      if (!item) {
        set.status = creatorNotFound ? 404 : 500;
        return { message: creatorNotFound ? "创作者不存在" : "更新创作者标签失败" };
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
      const result = await creatorsService.delete(id, { force });
      if (result.blocked) {
        set.status = 409;
        return {
          message: "创作者存在关联，继续删除将清理关联引用",
          ...result.impact,
          hasRefs: true,
          canForce: true,
        };
      }
      if (result.notFound || !result.item) {
        set.status = 404;
        return { message: "创作者不存在" };
      }
      return result.item;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ force: t.Optional(t.String()) }),
    }
  );
