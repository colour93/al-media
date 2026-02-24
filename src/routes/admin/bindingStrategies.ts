import { Elysia, t } from "elysia";
import { bindingStrategiesService } from "../../services/bindingStrategies";
import {
  paginationQuerySchema,
  parsePagination,
} from "../../utils/pagination";

const bindingStrategyTypeSchema = t.Union([t.Literal("folder"), t.Literal("regex")]);

const createBodySchema = t.Object({
  type: bindingStrategyTypeSchema,
  fileDirId: t.Number(),
  folderPath: t.Optional(t.Nullable(t.String())),
  filenameRegex: t.Optional(t.Nullable(t.String())),
  tagIds: t.Optional(t.Array(t.Number())),
  creatorIds: t.Optional(t.Array(t.Number())),
  actorIds: t.Optional(t.Array(t.Number())),
  enabled: t.Optional(t.Boolean()),
});

const updateBodySchema = t.Object({
  type: t.Optional(bindingStrategyTypeSchema),
  fileDirId: t.Optional(t.Number()),
  folderPath: t.Optional(t.Nullable(t.String())),
  filenameRegex: t.Optional(t.Nullable(t.String())),
  tagIds: t.Optional(t.Array(t.Number())),
  creatorIds: t.Optional(t.Array(t.Number())),
  actorIds: t.Optional(t.Array(t.Number())),
  enabled: t.Optional(t.Boolean()),
});

export const bindingStrategiesRoutes = new Elysia({ prefix: "/binding-strategies" })
  .get(
    "/",
    async ({ query, set }) => {
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return bindingStrategiesService.findMany(
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
    "/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const item = await bindingStrategiesService.findById(id);
      if (!item) {
        set.status = 404;
        return { message: "策略不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/",
    async ({ body, set }) => {
      const result = await bindingStrategiesService.create({
        type: body.type,
        fileDirId: body.fileDirId,
        folderPath: body.folderPath ?? undefined,
        filenameRegex: body.filenameRegex ?? undefined,
        tagIds: body.tagIds,
        creatorIds: body.creatorIds,
        actorIds: body.actorIds,
        enabled: body.enabled,
      });
      if ("error" in result) {
        set.status = 400;
        return { message: result.error };
      }
      set.status = 201;
      return result.item;
    },
    { body: createBodySchema }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const result = await bindingStrategiesService.update(id, {
        type: body.type,
        fileDirId: body.fileDirId,
        folderPath: body.folderPath ?? undefined,
        filenameRegex: body.filenameRegex ?? undefined,
        tagIds: body.tagIds,
        creatorIds: body.creatorIds,
        actorIds: body.actorIds,
        enabled: body.enabled,
      });
      if ("error" in result) {
        if (result.error === "策略不存在") set.status = 404;
        else set.status = 400;
        return { message: result.error };
      }
      return result.item;
    },
    {
      params: t.Object({ id: t.String() }),
      body: updateBodySchema,
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
      const item = await bindingStrategiesService.delete(id);
      if (!item) {
        set.status = 404;
        return { message: "策略不存在" };
      }
      return item;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/:id/apply",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const result = await bindingStrategiesService.applyStrategy(id);
      if ("error" in result) {
        if (result.error === "策略不存在") set.status = 404;
        else set.status = 400;
        return { message: result.error };
      }
      return result;
    },
    { params: t.Object({ id: t.String() }) }
  );
