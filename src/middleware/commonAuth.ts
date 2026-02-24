import { Elysia } from "elysia";
import { verifySessionToken } from "../services/auth";
import { usersService } from "../services/users";

const SESSION_COOKIE = "al_media_session";
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === "true" || process.env.REQUIRE_LOGIN === "1";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1].trim() : undefined;
}

/** 当 REQUIRE_LOGIN 时校验登录，允许任意已登录用户 */
export const commonAuthGuard = new Elysia({ name: "commonAuth" })
  .derive(async ({ request, set }) => {
    if (!REQUIRE_LOGIN) {
      return { user: null, authFailed: false };
    }
    const cookieHeader = request.headers.get("Cookie");
    const token = getCookieFromHeader(cookieHeader ?? null, SESSION_COOKIE);
    const payload = token ? await verifySessionToken(token) : null;
    const user = payload ? await usersService.findById(payload.userId) : null;

    if (!user) {
      set.status = 401;
      return {
        user: null,
        authFailed: true,
      };
    }
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      authFailed: false,
    };
  })
  .onBeforeHandle(({ authFailed, set }) => {
    if (authFailed) {
      set.status = 401;
      return {
        success: false,
        error: { message: "请先登录" },
      };
    }
  });

export function isRequireLogin(): boolean {
  return REQUIRE_LOGIN;
}
