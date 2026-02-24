import { ADMIN_API } from '../config/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    let message = res.statusText || `请求失败 ${res.status}`;
    if (body && typeof body === 'object') {
      if ('error' in body && body.error && typeof body.error === 'object' && 'message' in body.error) {
        message = String((body.error as { message: unknown }).message);
      } else if ('message' in body && typeof (body as { message: unknown }).message === 'string') {
        message = String((body as { message: unknown }).message);
      }
    }
    throw new ApiError(message, res.status, body);
  }

  // Backend wraps success responses as { success: true, data }
  if (body && typeof body === 'object' && 'success' in body && body.success === true && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export interface RequestParams {
  page?: number;
  pageSize?: number;
  q?: string;
  [key: string]: string | number | boolean | undefined;
}

function buildUrl(path: string, params?: RequestParams): string {
  const base = path.startsWith('http') ? path : `${ADMIN_API}${path}`;
  if (!params || Object.keys(params).length === 0) return base;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      search.set(k, String(v));
    }
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

const fetchOpts = { credentials: 'include' as RequestCredentials };

export async function get<T>(path: string, params?: RequestParams): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    ...fetchOpts,
  });
  return handleResponse<T>(res);
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: isFormData ? {} : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    ...fetchOpts,
  });
  return handleResponse<T>(res);
}

export async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    ...fetchOpts,
  });
  return handleResponse<T>(res);
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    ...fetchOpts,
  });
  return handleResponse<T>(res);
}

export async function del<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    ...fetchOpts,
  });
  return handleResponse<T>(res);
}
