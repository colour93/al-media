import { Elysia } from "elysia";
import * as oidc from "openid-client";
import {
  getOidcConfig,
  buildRedirectUri,
  resolveRoleForNewUser,
  createSessionToken,
  verifySessionToken,
  canAccessAdminByRole,
  isAuthConfigured,
} from "../services/auth";
import { usersService } from "../services/users";
import { createLogger } from "../utils/logger";

const logger = createLogger("auth");

const SESSION_COOKIE = "al_media_session";
const PKCE_COOKIE = "_oidc_pkce";
const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? "http://localhost:39995";

function getCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return undefined;
  let val = match[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

const APP_URL = process.env.APP_URL ?? "http://localhost:39996";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .get("/config", () => ({
    success: true,
    data: {
      requireLogin: process.env.REQUIRE_LOGIN === "true" || process.env.REQUIRE_LOGIN === "1",
    },
  }))
  .derive(async ({ request }) => {
    const token = getCookieValue(request.headers.get("Cookie"), SESSION_COOKIE);
    const payload = token ? await verifySessionToken(token) : null;
    return { session: payload };
  })
  .get("/oidc/authorize", async ({ query, redirect, set }) => {
    if (!isAuthConfigured()) {
      set.status = 503;
      return { success: false, error: { message: "OIDC 未配置" } };
    }
    const returnTo = (query.return_to as string) ?? "admin";
    const isApp = returnTo === "app";
    const redirectUri = isApp
      ? `${APP_URL}/api/auth/oidc/callback`
      : buildRedirectUri();

    const config = await getOidcConfig();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();

    const params: Record<string, string> = {
      redirect_uri: redirectUri,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    };
    if (!config.serverMetadata().supportsPKCE()) {
      params.nonce = oidc.randomNonce();
    }

    const authUrl = oidc.buildAuthorizationUrl(config, params);
    const pkceData = JSON.stringify({ state, codeVerifier, returnTo });
    const pkceEncoded = Buffer.from(pkceData).toString("base64url");
    set.headers["Set-Cookie"] = `${PKCE_COOKIE}=${pkceEncoded}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`;
    return redirect(authUrl.toString(), 302);
  })
  .get("/oidc/callback", async ({ query, redirect, set, request }) => {
    if (!isAuthConfigured()) {
      return redirect(`${ADMIN_APP_URL}/login?error=oidc_not_configured`, 302);
    }
    const code = query.code as string | undefined;
    const state = query.state as string | undefined;
    if (!code || !state) {
      return redirect(`${ADMIN_APP_URL}/login?error=missing_params`, 302);
    }

    const pkceRaw = getCookieValue(request.headers.get("Cookie"), PKCE_COOKIE);
    if (!pkceRaw) {
      return redirect(`${ADMIN_APP_URL}/login?error=no_pkce_state`, 302);
    }
    let pkce: { state: string; codeVerifier: string; returnTo?: string };
    const parsePkce = (raw: string): { state: string; codeVerifier: string; returnTo?: string } | null => {
      for (const fn of [
        () => JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")),
        () => JSON.parse(decodeURIComponent(raw)),
      ]) {
        try {
          const p = fn();
          if (typeof p?.state === "string" && typeof p?.codeVerifier === "string") return p as { state: string; codeVerifier: string; returnTo?: string };
        } catch {
          /* try next */
        }
      }
      return null;
    };
    const parsed = parsePkce(pkceRaw);
    if (!parsed) {
      logger.warn("PKCE cookie 解析失败");
      return redirect(`${ADMIN_APP_URL}/login?error=invalid_pkce`, 302);
    }
    pkce = parsed;
    if (pkce.state !== state) {
      return redirect(`${ADMIN_APP_URL}/login?error=state_mismatch`, 302);
    }

    const config = await getOidcConfig();

    // 使用与 authorize 相同的 redirect_uri 构造回调 URL，避免代理导致 request.url 为后端地址、redirect_uri 与授权不一致
    const redirectUri =
      pkce.returnTo === "app"
        ? `${APP_URL}/api/auth/oidc/callback`
        : buildRedirectUri();
    const callbackUrl = new URL(redirectUri);
    callbackUrl.search = new URL(request.url).search;

    let tokens: oidc.TokenEndpointResponse;
    let identifier: string;
    let email: string | undefined;
    let name: string | undefined;
    try {
      tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: pkce.codeVerifier,
        expectedState: state,
        idTokenExpected: true,
      });
      const claims = (tokens as { claims?(): Record<string, unknown> }).claims?.();
      const sub = (claims?.sub ?? "") as string;
      email = (claims?.email ?? claims?.preferred_username) as string | undefined;
      name = (claims?.name ?? claims?.preferred_username) as string | undefined;
      if (!email && !sub) {
        throw new Error("ID Token 缺少 email 或 sub");
      }
      identifier = (email ?? sub).trim();
    } catch (err) {
      logger.error(err, "OIDC token exchange 失败");
      return redirect(`${ADMIN_APP_URL}/login?error=token_exchange_failed`, 302);
    }

    const role = await resolveRoleForNewUser(identifier);
    if (role === null || !canAccessAdminByRole(role)) {
      return redirect(`${ADMIN_APP_URL}/login?error=unauthorized`, 302);
    }

    const user = await usersService.createOrUpdateFromOidc(identifier, role, { email: email ?? undefined, name });
    const token = await createSessionToken({
      userId: user.id,
      role: user.role as "owner" | "admin",
      sub: identifier,
    });

    const secure = process.env.NODE_ENV === "production";
    const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : "";
    const sessionCookie = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 7}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}${domain}`;
    const pkceClearCookie = `${PKCE_COOKIE}=; Path=/; Max-Age=0`;

    const postLoginUrl = pkce.returnTo === "app" ? APP_URL : ADMIN_APP_URL;

    const headers = new Headers();
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", pkceClearCookie);
    headers.append("Location", postLoginUrl);

    return new Response(null, { status: 302, headers });
  })
  .get("/me", async ({ session }) => {
    if (!session) {
      return { success: false, data: null };
    }
    const user = await usersService.findById(session.userId);
    if (!user || !canAccessAdminByRole(user.role as "owner" | "admin")) {
      return { success: false, data: null };
    }
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  })
  .post("/logout", ({ set }) => {
    const secure = process.env.NODE_ENV === "production";
    const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : "";
    set.headers["Set-Cookie"] = `${SESSION_COOKIE}=; Path=/; Max-Age=0${secure ? "; Secure" : ""}${domain}`;
    return { success: true };
  });
