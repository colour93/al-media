import { get } from './client';
import type { PaginatedResult } from './types';
import type { VideoDetail } from './types';

const BASE = '/videos';

export async function fetchVideosList(
  page: number,
  pageSize: number,
  params?: { q?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }
): Promise<PaginatedResult<VideoDetail>> {
  const p: Record<string, string | number> = { page, pageSize };
  if (params?.q) p.q = params.q;
  if (params?.sortBy) p.sortBy = params.sortBy;
  if (params?.sortOrder) p.sortOrder = params.sortOrder;
  return get<PaginatedResult<VideoDetail>>(BASE, p);
}

export async function fetchVideo(id: number): Promise<VideoDetail> {
  return get<VideoDetail>(`${BASE}/${id}`);
}

export async function fetchRecommended(): Promise<VideoDetail[]> {
  return get<VideoDetail[]>(`${BASE}/recommended`);
}

export async function fetchBanner(): Promise<VideoDetail[]> {
  return get<VideoDetail[]>(`${BASE}/banner`);
}

export async function fetchLatest(
  page: number,
  pageSize: number
): Promise<PaginatedResult<VideoDetail>> {
  return get<PaginatedResult<VideoDetail>>(`${BASE}/latest`, { page, pageSize });
}
