import { randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
import * as jose from "jose";
import * as oidc from "openid-client";
import {
  getOidcConfig,
  buildRedirectUri,
  getRoleFromClaims,
  createSessionToken,
  verifySessionToken,
  canAccessAdminByRole,
  canAccessCommonByRole,
  isAuthConfigured,
  type SessionPayload,
} from "../services/auth";
import { usersService } from "../services/users";
import { createLogger } from "../utils/logger";
import {
  getPublicSiteConfig,
  getPublicSiteManifest,
} from "../services/siteConfig";
import {
  SESSION_COOKIE,
  getCookieFromHeader,
  resolveSessionTokenFromRequest,
} from "../utils/sessionToken";

const logger = createLogger("auth");

const PKCE_COOKIE = "_oidc_pkce";
const APP_URL = process.env.APP_URL ?? process.env.BASE_URL ?? "http://localhost:39994";
const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? `${APP_URL}/admin`;
const DEFAULT_FLUTTER_REDIRECT_URI = process.env.FLUTTER_APP_REDIRECT_URI ?? "almedia://auth/callback";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const AUTH_CODE_TTL_MS = 2 * 60 * 1000;

type ReturnTo = "admin" | "app" | "flutter";

type PkceState = {
  state: string;
  codeVerifier: string;
  returnTo: ReturnTo;
  appRedirectUri?: string;
};

type ExchangeUser = {
  id: number;
  email: string | null;
  name: string | null;
  role: string;
};

type PendingAuthCode = {
  payload: SessionPayload;
  user: ExchangeUser;
  expiresAt: number;
};

const authCodeStore = new Map<string, PendingAuthCode>();

function normalizeReturnTo(value: unknown): ReturnTo {
  if (value === "app") {
    return "app";
  }
  if (value === "flutter") {
    return "flutter";
  }
  return "admin";
}

function normalizeFlutterRedirectUri(value: unknown): string | null {
  const candidate = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_FLUTTER_REDIRECT_URI;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "almedia:") {
      return null;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function appendErrorToUrl(targetUrl: string, errorCode: string): string {
  const url = new URL(targetUrl);
  url.searchParams.set("error", errorCode);
  return url.toString();
}

function getErrorRedirectUrl(returnTo: ReturnTo, appRedirectUri: string | undefined, errorCode: string): string {
  if (returnTo === "flutter" && appRedirectUri) {
    return appendErrorToUrl(appRedirectUri, errorCode);
  }
  if (returnTo === "app") {
    return `${APP_URL}/login?error=${errorCode}`;
  }
  return `${ADMIN_APP_URL}/login?error=${errorCode}`;
}

function cleanupAuthCodes(now = Date.now()): void {
  for (const [code, entry] of authCodeStore.entries()) {
    if (entry.expiresAt <= now) {
      authCodeStore.delete(code);
    }
  }
}

function issueAuthCode(payload: SessionPayload, user: ExchangeUser): string {
  cleanupAuthCodes();
  const code = randomUUID().replaceAll("-", "");
  authCodeStore.set(code, {
    payload,
    user,
    expiresAt: Date.now() + AUTH_CODE_TTL_MS,
  });
  return code;
}

function consumeAuthCode(code: string): PendingAuthCode | null {
  cleanupAuthCodes();
  const record = authCodeStore.get(code);
  if (!record) {
    return null;
  }
  authCodeStore.delete(code);
  if (record.expiresAt <= Date.now()) {
    return null;
  }
  return record;
}

function parsePkce(raw: string): PkceState | null {
  for (const parse of [
    () => JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")),
    () => JSON.parse(decodeURIComponent(raw)),
  ]) {
    try {
      const parsed = parse();
      if (
        typeof parsed?.state === "string" &&
        typeof parsed?.codeVerifier === "string"
      ) {
        return {
          state: parsed.state,
          codeVerifier: parsed.codeVerifier,
          returnTo: normalizeReturnTo(parsed.returnTo),
          appRedirectUri:
            typeof parsed.appRedirectUri === "string"
              ? parsed.appRedirectUri
              : undefined,
        };
      }
    } catch {
      // try next parse
    }
  }
  return null;
}

function buildSessionCookie(token: string): string {
  const secure = process.env["NODE_ENV"] === "production";
  const domain = process.env.COOKIE_DOMAIN
    ? `; Domain=${process.env.COOKIE_DOMAIN}`
    : "";
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}${domain}`;
}

function buildClearSessionCookie(): string {
  const secure = process.env["NODE_ENV"] === "production";
  const domain = process.env.COOKIE_DOMAIN
    ? `; Domain=${process.env.COOKIE_DOMAIN}`
    : "";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0${secure ? "; Secure" : ""}${domain}`;
}

function buildClearPkceCookie(): string {
  return `${PKCE_COOKIE}=; Path=/; Max-Age=0`;
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .get("/config", () => ({
    success: true,
    data: {
      requireLogin:
        process.env.REQUIRE_LOGIN === "true" || process.env.REQUIRE_LOGIN === "1",
      site: getPublicSiteConfig(),
    },
  }))
  .get("/manifest.webmanifest", () => {
    return new Response(JSON.stringify(getPublicSiteManifest()), {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  })
  .derive(async ({ request }) => {
    const token = resolveSessionTokenFromRequest(request);
    const payload = token ? await verifySessionToken(token) : null;
    return { session: payload };
  })
  .get("/oidc/authorize", async ({ query, redirect, set }) => {
    if (!isAuthConfigured()) {
      set.status = 503;
      return { success: false, error: { message: "OIDC 未配置" } };
    }

    const returnTo = normalizeReturnTo(query.return_to);
    const isAdmin = returnTo === "admin";
    const isFlutter = returnTo === "flutter";

    const appRedirectUri =
      isFlutter ? normalizeFlutterRedirectUri(query.redirect_uri) : undefined;
    if (isFlutter && !appRedirectUri) {
      set.status = 400;
      return { message: "redirect_uri 无效，需为 almedia:// scheme" };
    }

    const redirectUri = isAdmin
      ? buildRedirectUri()
      : `${APP_URL}/api/auth/oidc/callback`;

    const config = await getOidcConfig();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();

    const params: Record<string, string> = {
      redirect_uri: redirectUri,
      scope: "openid email profile roles",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    };
    if (!config.serverMetadata().supportsPKCE()) {
      params.nonce = oidc.randomNonce();
    }

    const authUrl = oidc.buildAuthorizationUrl(config, params);
    const pkceData: PkceState = {
      state,
      codeVerifier,
      returnTo,
      appRedirectUri,
    };
    const pkceEncoded = Buffer.from(JSON.stringify(pkceData)).toString("base64url");
    set.headers["Set-Cookie"] = `${PKCE_COOKIE}=${pkceEncoded}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`;
    return redirect(authUrl.toString(), 302);
  })
  .get("/oidc/callback", async ({ query, redirect, request }) => {
    if (!isAuthConfigured()) {
      return redirect(`${ADMIN_APP_URL}/login?error=oidc_not_configured`, 302);
    }

    const code = query.code as string | undefined;
    const state = query.state as string | undefined;
    if (!code || !state) {
      return redirect(`${ADMIN_APP_URL}/login?error=missing_params`, 302);
    }

    const pkceRaw = getCookieFromHeader(request.headers.get("Cookie"), PKCE_COOKIE);
    if (!pkceRaw) {
      return redirect(`${ADMIN_APP_URL}/login?error=no_pkce_state`, 302);
    }

    const pkce = parsePkce(pkceRaw);
    if (!pkce) {
      logger.warn("PKCE cookie 解析失败");
      return redirect(`${ADMIN_APP_URL}/login?error=invalid_pkce`, 302);
    }

    if (pkce.state !== state) {
      const errorUrl = getErrorRedirectUrl(pkce.returnTo, pkce.appRedirectUri, "state_mismatch");
      return redirect(errorUrl, 302);
    }

    const config = await getOidcConfig();

    const redirectUri =
      pkce.returnTo === "admin"
        ? buildRedirectUri()
        : `${APP_URL}/api/auth/oidc/callback`;
    const callbackUrl = new URL(redirectUri);
    callbackUrl.search = new URL(request.url).search;

    let identifier: string;
    let email: string | undefined;
    let name: string | undefined;
    let claims: Record<string, unknown>;

    try {
      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: pkce.codeVerifier,
        expectedState: state,
        idTokenExpected: true,
      });

      const idClaims =
        (tokens as { claims?(): Record<string, unknown> }).claims?.() ?? {};
      const sub = (idClaims.sub ?? "") as string;
      email = (idClaims.email ?? idClaims.preferred_username) as
        | string
        | undefined;
      name = (idClaims.name ?? idClaims.preferred_username) as
        | string
        | undefined;

      if (!email && !sub) {
        throw new Error("ID Token 缺少 email 或 sub");
      }
      identifier = (email ?? sub).trim();

      const accessToken = (tokens as { access_token?: string }).access_token;
      claims = accessToken
        ? (jose.decodeJwt(accessToken) as Record<string, unknown>)
        : idClaims;
    } catch (err) {
      logger.error(err, "OIDC token exchange 失败");
      const errorUrl = getErrorRedirectUrl(
        pkce.returnTo,
        pkce.appRedirectUri,
        "token_exchange_failed",
      );
      return redirect(errorUrl, 302);
    }

    const role = getRoleFromClaims(claims);
    if (role === null) {
      const errorUrl = getErrorRedirectUrl(
        pkce.returnTo,
        pkce.appRedirectUri,
        "unauthorized",
      );
      return redirect(errorUrl, 302);
    }

    const canAccess =
      pkce.returnTo === "admin"
        ? canAccessAdminByRole(role)
        : canAccessCommonByRole(role);
    if (!canAccess) {
      const errorUrl = getErrorRedirectUrl(
        pkce.returnTo,
        pkce.appRedirectUri,
        "unauthorized",
      );
      return redirect(errorUrl, 302);
    }

    const user = await usersService.createOrUpdateFromOidc(identifier, role, {
      email: email ?? undefined,
      name,
    });

    const payload: SessionPayload = {
      userId: user.id,
      role: user.role as "owner" | "admin" | "member",
      sub: identifier,
    };

    const headers = new Headers();
    headers.append("Set-Cookie", buildClearPkceCookie());

    if (pkce.returnTo === "flutter") {
      if (!pkce.appRedirectUri) {
        return redirect(`${ADMIN_APP_URL}/login?error=missing_params`, 302);
      }

      const authCode = issueAuthCode(payload, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      const appCallbackUrl = new URL(pkce.appRedirectUri);
      appCallbackUrl.searchParams.set("code", authCode);
      headers.append("Location", appCallbackUrl.toString());
      return new Response(null, { status: 302, headers });
    }

    const sessionToken = await createSessionToken(payload);
    headers.append("Set-Cookie", buildSessionCookie(sessionToken));
    headers.append("Location", pkce.returnTo === "app" ? APP_URL : ADMIN_APP_URL);

    return new Response(null, { status: 302, headers });
  })
  .post(
    "/exchange",
    async ({ body, set }) => {
      const authCodeRaw = body.authCode ?? body.auth_code;
      const authCode = typeof authCodeRaw === "string" ? authCodeRaw.trim() : "";
      if (!authCode) {
        set.status = 400;
        return { message: "auth_code 无效" };
      }

      const record = consumeAuthCode(authCode);
      if (!record) {
        set.status = 400;
        return { message: "auth_code 无效或已过期" };
      }

      const accessToken = await createSessionToken(record.payload);
      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn: SESSION_MAX_AGE_SECONDS,
        user: record.user,
      };
    },
    {
      body: t.Object({
        authCode: t.Optional(t.String()),
        auth_code: t.Optional(t.String()),
      }),
    },
  )
  .get("/me", async ({ session }) => {
    if (!session) {
      return { success: false, data: null };
    }
    const user = await usersService.findById(session.userId);
    if (!user) {
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
    set.headers["Set-Cookie"] = buildClearSessionCookie();
    return { success: true };
  });
