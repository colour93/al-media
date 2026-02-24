import { get } from './client';
import type { PaginatedResult } from './types';
import type { VideoFile } from './types';

const BASE = '/video-files';

export async function fetchVideoFilesList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFile>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFile>>(BASE, params);
}

export async function searchVideoFiles(
  keyword: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFile>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFile>>(`${BASE}/search`, params);
}

export async function fetchVideoFile(id: number): Promise<VideoFile> {
  return get<VideoFile>(`${BASE}/${id}`);
}
