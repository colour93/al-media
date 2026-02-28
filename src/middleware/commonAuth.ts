import { Elysia } from "elysia";
import { verifySessionToken } from "../services/auth";
import { usersService, canAccessCommon } from "../services/users";
import type { UserRole } from "../services/users";

const SESSION_COOKIE = "al_media_session";
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === "true" || process.env.REQUIRE_LOGIN === "1";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
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

/** 当 REQUIRE_LOGIN 时校验登录，仅 owner/admin/member 可访问 common */
export const commonAuthGuard = new Elysia({ name: "commonAuth" })
  .derive(async ({ request, set }) => {
    const cookieHeader = request.headers.get("Cookie");
    const token = getCookieFromHeader(cookieHeader ?? null, SESSION_COOKIE);
    const payload = token ? await verifySessionToken(token) : null;
    const user = payload ? await usersService.findById(payload.userId) : null;

    if (REQUIRE_LOGIN && (!user || !canAccessCommon(user.role as UserRole))) {
      set.status = 401;
      return {
        user: null,
        authFailed: true,
      };
    }

    if (!user || !canAccessCommon(user.role as UserRole)) {
      return { user: null, authFailed: false };
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
