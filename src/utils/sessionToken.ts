export const SESSION_COOKIE = "al_media_session";

export function getCookieFromHeader(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return undefined;

  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getBearerTokenFromHeader(
  authorizationHeader: string | null,
): string | undefined {
  if (!authorizationHeader) return undefined;
  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (!scheme || !token) return undefined;
  if (scheme.toLowerCase() !== "bearer") return undefined;
  return token.trim() || undefined;
}

export function resolveSessionTokenFromRequest(request: Request): string | undefined {
  const bearerToken = getBearerTokenFromHeader(request.headers.get("Authorization"));
  if (bearerToken) {
    return bearerToken;
  }

  return getCookieFromHeader(request.headers.get("Cookie"), SESSION_COOKIE);
}
