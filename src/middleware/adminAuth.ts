import { Elysia } from "elysia";
import { verifySessionToken } from "../services/auth";
import { usersService } from "../services/users";
import { canAccessAdmin } from "../services/users";
import type { UserRole } from "../services/users";
import { resolveSessionTokenFromRequest } from "../utils/sessionToken";

export const adminAuthGuard = new Elysia({ name: "adminAuth" })
  .derive(async ({ request, set }) => {
    const token = resolveSessionTokenFromRequest(request);
    const payload = token ? await verifySessionToken(token) : null;
    const user = payload ? await usersService.findById(payload.userId) : null;
    const canAccess =
      !!user && canAccessAdmin((user.role as UserRole));

    if (!canAccess) {
      set.status = 401;
      return {
        user: null as { id: number; email: string | null; name: string | null; role: string } | null,
        authFailed: true,
      };
    }
    return {
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
      },
      authFailed: false,
    };
  })
  .onBeforeHandle(({ user, authFailed, set }) => {
    if (authFailed) {
      set.status = 401;
      return {
        success: false,
        error: { message: "未登录或无权访问管理端" },
      };
    }
  });
