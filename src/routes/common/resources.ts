import { Elysia, t } from "elysia";
import { resourcesService, type ResourceCategory } from "../../services/resources";
import { parsePagination } from "../../utils/pagination";

const resourceCategorySchema = t.Union([
  t.Literal("all"),
  t.Literal("video"),
  t.Literal("actor"),
  t.Literal("creator"),
  t.Literal("distributor"),
  t.Literal("tag"),
]);

function parseTagIdList(value?: string): number[] {
  if (!value) return [];
  return [...new Set(
    value
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

export const commonResourcesRoutes = new Elysia({ prefix: "/resources" })
  .get(
    "/search",
    async ({ query, set }) => {
      const pagination = parsePagination(
        {
          page: query.page ?? "1",
          pageSize: query.pageSize ?? "12",
        },
        set
      );
      if (!pagination) return { message: "分页参数无效" };

      const category = (query.category as ResourceCategory | undefined) ?? "all";
      const includeTagIds = parseTagIdList(query.includeTagIds);
      const excludeTagIds = parseTagIdList(query.excludeTagIds);

      return resourcesService.search({
        q: query.q,
        category,
        page: pagination.page,
        pageSize: pagination.pageSize,
        includeTagIds,
        excludeTagIds,
      });
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        category: t.Optional(resourceCategorySchema),
        page: t.Optional(t.String({ default: "1" })),
        pageSize: t.Optional(t.String({ default: "12" })),
        includeTagIds: t.Optional(t.String()),
        excludeTagIds: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/tags",
    async ({ query, set }) => {
      const pagination = parsePagination(
        {
          page: query.page ?? "1",
          pageSize: query.pageSize ?? "30",
        },
        set
      );
      if (!pagination) return { message: "分页参数无效" };

      return resourcesService.searchTagOptions(
        query.q,
        pagination.page,
        pagination.pageSize
      );
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        page: t.Optional(t.String({ default: "1" })),
        pageSize: t.Optional(t.String({ default: "30" })),
      }),
    }
  );
