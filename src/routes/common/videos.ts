import { Elysia, t } from "elysia";
import { verifySessionToken } from "../../services/auth";
import { canAccessCommon, usersService } from "../../services/users";
import { userVideoInteractionsService } from "../../services/userVideoInteractions";
import { videosService } from "../../services/videos";
import {
  paginationQuerySchema,
  parsePagination,
  parseSearchQuery,
  searchQuerySchema,
} from "../../utils/pagination";

const SESSION_COOKIE = "al_media_session";

function getCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return undefined;
  let val = match[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

async function resolveAuthedUserId(ctx: { request: Request; user?: { id: number; role?: string } | null }) {
  if (ctx.user?.id) return ctx.user.id;
  const token = getCookieValue(ctx.request.headers.get("Cookie"), SESSION_COOKIE);
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const user = await usersService.findById(payload.userId);
  if (!user || !canAccessCommon(user.role)) return null;
  return user.id;
}

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
    "/favorites",
    async (ctx) => {
      const { query, set } = ctx;
      const userId = await resolveAuthedUserId(ctx as { request: Request; user?: { id: number } | null });
      if (!userId) {
        set.status = 401;
        return { message: "请先登录" };
      }
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return userVideoInteractionsService.listFavorites(
        userId,
        pagination.page,
        pagination.pageSize,
        pagination.offset
      );
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/history",
    async (ctx) => {
      const { query, set } = ctx;
      const userId = await resolveAuthedUserId(ctx as { request: Request; user?: { id: number } | null });
      if (!userId) {
        set.status = 401;
        return { message: "请先登录" };
      }
      const pagination = parsePagination(query, set);
      if (!pagination) return { message: "分页参数无效" };
      return userVideoInteractionsService.listHistory(
        userId,
        pagination.page,
        pagination.pageSize,
        pagination.offset
      );
    },
    { query: paginationQuerySchema }
  )
  .get(
    "/:id/interactions",
    async (ctx) => {
      const { params, set } = ctx;
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const userId = await resolveAuthedUserId(ctx as { request: Request; user?: { id: number } | null });
      if (!userId) {
        return {
          isFavorite: false,
          history: null,
        };
      }
      const state = await userVideoInteractionsService.getInteractionState(userId, id);
      if (!state) {
        set.status = 404;
        return { message: "视频不存在" };
      }
      return state;
    },
    { params: t.Object({ id: t.String() }) }
  )
  .post(
    "/:id/favorite",
    async (ctx) => {
      const { params, body, set } = ctx;
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const userId = await resolveAuthedUserId(ctx as { request: Request; user?: { id: number } | null });
      if (!userId) {
        set.status = 401;
        return { message: "请先登录" };
      }
      const result = await userVideoInteractionsService.setFavorite(userId, id, body.favorite);
      if (result.error) {
        set.status = 404;
        return { message: result.error };
      }
      return { isFavorite: result.isFavorite === true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ favorite: t.Boolean() }),
    }
  )
  .post(
    "/:id/history",
    async (ctx) => {
      const { params, body, set } = ctx;
      const id = Number(params.id);
      if (!Number.isInteger(id)) {
        set.status = 400;
        return { message: "ID 无效" };
      }
      const userId = await resolveAuthedUserId(ctx as { request: Request; user?: { id: number } | null });
      if (!userId) {
        set.status = 401;
        return { message: "请先登录" };
      }
      const result = await userVideoInteractionsService.upsertHistory(userId, id, {
        progressSeconds: body.progressSeconds,
        durationSeconds: body.durationSeconds,
        completed: body.completed,
      });
      if (result.error) {
        set.status = 404;
        return { message: result.error };
      }
      return result.history;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        progressSeconds: t.Number({ minimum: 0 }),
        durationSeconds: t.Optional(t.Number({ minimum: 0 })),
        completed: t.Optional(t.Boolean()),
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
