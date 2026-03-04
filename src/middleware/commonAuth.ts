import { Elysia } from "elysia";
import { verifySessionToken } from "../services/auth";
import { usersService, canAccessCommon } from "../services/users";
import type { UserRole } from "../services/users";
import { resolveSessionTokenFromRequest } from "../utils/sessionToken";
const REQUIRE_LOGIN = process.env.REQUIRE_LOGIN === "true" || process.env.REQUIRE_LOGIN === "1";

/** 当 REQUIRE_LOGIN 时校验登录，仅 owner/admin/member 可访问 common */
export const commonAuthGuard = new Elysia({ name: "commonAuth" })
  .derive(async ({ request, set }) => {
    const token = resolveSessionTokenFromRequest(request);
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
