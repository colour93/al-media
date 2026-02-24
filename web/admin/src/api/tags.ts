import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { Tag, TagType } from './types';

const BASE = '/tags';

export interface TagWithType extends Tag {
  tagType?: TagType;
}

export async function fetchTagsList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<TagWithType>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<TagWithType>>(BASE, params);
}

export async function searchTags(
  keyword: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<TagWithType>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<TagWithType>>(`${BASE}/search`, params);
}

export type TagRelatedCategory = 'actor' | 'creator' | 'video';

export async function fetchTag(id: number): Promise<Tag> {
  return get<Tag>(`${BASE}/${id}`);
}

export async function fetchTagRelated<T = unknown>(
  tagId: number,
  category: TagRelatedCategory,
  page: number,
  pageSize: number
): Promise<PaginatedResult<T>> {
  return get<PaginatedResult<T>>(`${BASE}/${tagId}/related`, {
    category,
    page,
    pageSize,
  });
}

export async function createTag(data: { name: string; tagTypeId: number; color?: string }): Promise<Tag> {
  return post<Tag>(BASE, data);
}

export async function updateTag(
  id: number,
  data: { name?: string; tagTypeId?: number; color?: string }
): Promise<Tag> {
  return patch<Tag>(`${BASE}/${id}`, data);
}

export async function deleteTag(id: number): Promise<Tag> {
  return del<Tag>(`${BASE}/${id}`);
}
