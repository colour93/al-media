import { API_BASE } from '../config/api';
import type { SiteConfig } from '../config/site';
import { DEFAULT_SITE_CONFIG, normalizeSiteConfig } from '../config/site';

export interface AuthConfig {
  requireLogin: boolean;
  site: SiteConfig;
}

export interface AuthUser {
  id: number;
  email: string | null;
  name: string | null;
  role: string;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(`${API_BASE}/auth/config`, { credentials: 'include' });
  const json = await res.json();
  if (json.success && json.data) {
    return {
      requireLogin: !!json.data.requireLogin,
      site: normalizeSiteConfig(json.data.site),
    };
  }
  return { requireLogin: false, site: DEFAULT_SITE_CONFIG };
}

export async function fetchAuthMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
  const json = await res.json();
  return json.success && json.data ? json.data : null;
}

export function getOidcAuthorizeUrl(): string {
  return `${API_BASE}/auth/oidc/authorize?return_to=app`;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
}
