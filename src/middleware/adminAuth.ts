import { Elysia } from "elysia";
import { verifySessionToken } from "../services/auth";
import { usersService } from "../services/users";
import { canAccessAdmin } from "../services/users";
import type { UserRole } from "../services/users";

const SESSION_COOKIE = "al_media_session";

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

export const adminAuthGuard = new Elysia({ name: "adminAuth" })
  .derive(async ({ request, set }) => {
    const cookieHeader = request.headers.get("Cookie");
    const token = getCookieFromHeader(cookieHeader ?? null, SESSION_COOKIE);
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
