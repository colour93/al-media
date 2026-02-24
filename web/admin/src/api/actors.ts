import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { Actor, Video } from './types';

const BASE = '/actors';

export async function fetchActorsList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<Actor>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<Actor>>(BASE, params);
}

export async function searchActors(
  keyword: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<Actor>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<Actor>>(`${BASE}/search`, params);
}

export async function fetchActor(id: number): Promise<Actor> {
  return get<Actor>(`${BASE}/${id}`);
}

export async function fetchActorVideos(
  actorId: number,
  page: number,
  pageSize: number
): Promise<PaginatedResult<Video>> {
  return get<PaginatedResult<Video>>(`${BASE}/${actorId}/videos`, {
    page,
    pageSize,
  });
}

export async function createActor(data: {
  name: string;
  avatarKey?: string;
  tags?: number[];
}): Promise<Actor> {
  return post<Actor>(BASE, data);
}

export async function updateActor(
  id: number,
  data: { name?: string; avatarKey?: string; tags?: number[] }
): Promise<Actor> {
  return patch<Actor>(`${BASE}/${id}`, data);
}

export async function updateActorTags(id: number, tags: number[]): Promise<Actor> {
  return patch<Actor>(`${BASE}/${id}/tags`, { tags });
}

export async function deleteActor(id: number): Promise<Actor> {
  return del<Actor>(`${BASE}/${id}`);
}
