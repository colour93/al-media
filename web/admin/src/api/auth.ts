import { API_BASE, AUTH_API } from '../config/api';

export interface AuthUser {
  id: number;
  email: string | null;
  name: string | null;
  role: 'owner' | 'admin' | 'member';
}

export interface AuthMeResponse {
  success: boolean;
  data: AuthUser | null;
}

export async function fetchAuthMe(): Promise<AuthUser | null> {
  const res = await fetch(`${AUTH_API}/me`, {
    credentials: 'include',
  });
  const json: AuthMeResponse = await res.json();
  return json.success && json.data ? json.data : null;
}

export function getOidcAuthorizeUrl(): string {
  return `${API_BASE}/auth/oidc/authorize`;
}

export async function logout(): Promise<void> {
  await fetch(`${AUTH_API}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
