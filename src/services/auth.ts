import * as oidc from "openid-client";
import * as jose from "jose";
import type { UserRole } from "./users";
import { usersService, canAccessAdmin, canAccessCommon } from "./users";

const OIDC_ISSUER = process.env.OIDC_ISSUER;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI;
const OIDC_ROLE_CLAIM = process.env.OIDC_ROLE_CLAIM ?? "realm_access.roles"; // 从 Access Token 的哪个 claim 读取角色（Keycloak 的 realm_access.roles 在 Access Token 中）
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:39994";

export function isAuthConfigured(): boolean {
  return !!(
    OIDC_ISSUER &&
    OIDC_CLIENT_ID &&
    OIDC_CLIENT_SECRET &&
    OIDC_REDIRECT_URI &&
    JWT_SECRET
  );
}

let oidcConfig: Awaited<ReturnType<typeof oidc.discovery>> | null = null;

export async function getOidcConfig() {
  if (!OIDC_ISSUER || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET) {
    throw new Error("OIDC 未配置：缺少 OIDC_ISSUER / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET");
  }
  if (!oidcConfig) {
    oidcConfig = await oidc.discovery(
      new URL(OIDC_ISSUER),
      OIDC_CLIENT_ID,
      OIDC_CLIENT_SECRET
    );
  }
  return oidcConfig;
}

export function buildRedirectUri(): string {
  return OIDC_REDIRECT_URI ?? `${API_BASE_URL}/api/auth/oidc/callback`;
}

const VALID_ROLES: UserRole[] = ["owner", "admin", "member"];
const ROLE_PRIORITY: Record<UserRole, number> = { owner: 3, admin: 2, member: 1 };

function getClaimByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 从 OIDC claims 解析角色。claim 值可为 string 或 string[]，取优先级最高者 */
export function getRoleFromClaims(claims: Record<string, unknown>): UserRole | null {
  const raw = getClaimByPath(claims, OIDC_ROLE_CLAIM);
  if (raw == null) return null;
  const arr = Array.isArray(raw)
    ? (raw as string[]).map((s) => String(s).toLowerCase().trim())
    : [String(raw).toLowerCase().trim()];
  let best: UserRole | null = null;
  for (const r of arr) {
    const role = VALID_ROLES.find((v) => v === r) ?? null;
    if (role && (!best || ROLE_PRIORITY[role] > ROLE_PRIORITY[best])) best = role;
  }
  return best;
}

export function canAccessCommonByRole(role: UserRole): boolean {
  return canAccessCommon(role);
}

export interface SessionPayload {
  userId: number;
  role: UserRole;
  sub: string;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  if (!JWT_SECRET) throw new Error("JWT_SECRET 未配置");
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!JWT_SECRET) return null;
  const secret = new TextEncoder().encode(JWT_SECRET);
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    const p = payload as unknown as SessionPayload;
    if (p.userId && p.role && p.sub) return p;
    return null;
  } catch {
    return null;
  }
}

export function canAccessAdminByRole(role: UserRole): boolean {
  return canAccessAdmin(role);
}
