import * as oidc from "openid-client";
import * as jose from "jose";
import type { UserRole } from "./users";
import { usersService, canAccessAdmin } from "./users";

const OIDC_ISSUER = process.env.OIDC_ISSUER;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const OIDC_REDIRECT_URI = process.env.OIDC_REDIRECT_URI;
const OIDC_OWNER_EMAIL = process.env.OIDC_OWNER_EMAIL; // 可选：指定 owner 的邮箱
const OIDC_ADMIN_EMAILS = (process.env.OIDC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
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

/** 根据邮箱决定用户角色：owner > 环境变量配置的 admin > 首个登录为 owner，否则无权限 */
function resolveRole(email: string): UserRole | null {
  const e = email.toLowerCase().trim();
  if (OIDC_OWNER_EMAIL && e === OIDC_OWNER_EMAIL.toLowerCase()) return "owner";
  if (OIDC_ADMIN_EMAILS.includes(e)) return "admin";
  return null;
}

/** 解析新用户的角色。仅 owner、环境变量指定的 admin、或首个用户可获权，其他拒绝 */
export async function resolveRoleForNewUser(email: string): Promise<UserRole | null> {
  const envRole = resolveRole(email);
  if (envRole) return envRole;
  const count = await usersService.count();
  if (count === 0) return "owner"; // 首个用户为 owner
  return null; // 其他用户无权限
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
