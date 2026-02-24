import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { Creator, CreatorType, CreatorPlatform } from './types';

const BASE = '/creators';

export async function fetchCreatorsList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<Creator>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<Creator>>(BASE, params);
}

export async function searchCreators(
  keyword: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<Creator>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<Creator>>(`${BASE}/search`, params);
}

export async function fetchCreator(id: number): Promise<Creator> {
  return get<Creator>(`${BASE}/${id}`);
}

export async function fetchCreatorVideos(
  creatorId: number,
  page: number,
  pageSize: number
): Promise<PaginatedResult<import('./types').Video>> {
  return get<PaginatedResult<import('./types').Video>>(`${BASE}/${creatorId}/videos`, {
    page,
    pageSize,
  });
}

export async function createCreator(data: {
  name: string;
  type: CreatorType;
  actorId?: number | null;
  platform?: CreatorPlatform | null;
  platformId?: string | null;
  tags?: number[];
}): Promise<Creator> {
  return post<Creator>(BASE, data);
}

export async function updateCreator(
  id: number,
  data: {
    name?: string;
    type?: CreatorType;
    actorId?: number | null;
    platform?: CreatorPlatform | null;
    platformId?: string | null;
    tags?: number[];
  }
): Promise<Creator> {
  return patch<Creator>(`${BASE}/${id}`, data);
}

export async function deleteCreator(id: number): Promise<Creator> {
  return del<Creator>(`${BASE}/${id}`);
}
