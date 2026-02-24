import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { TagType } from './types';

const BASE = '/tag-types';

export async function fetchTagTypesList(page: number, pageSize: number): Promise<PaginatedResult<TagType>> {
  return get<PaginatedResult<TagType>>(BASE, { page, pageSize });
}

export async function searchTagTypes(
  keyword: string,
  page: number,
  pageSize: number
): Promise<PaginatedResult<TagType>> {
  return get<PaginatedResult<TagType>>(`${BASE}/search`, { q: keyword, page, pageSize });
}

export async function fetchTagType(id: number): Promise<TagType> {
  return get<TagType>(`${BASE}/${id}`);
}

export async function createTagType(data: { name: string; icon?: string }): Promise<TagType> {
  return post<TagType>(BASE, data);
}

export async function updateTagType(
  id: number,
  data: { name?: string; icon?: string }
): Promise<TagType> {
  return patch<TagType>(`${BASE}/${id}`, data);
}

export async function deleteTagType(id: number): Promise<TagType> {
  return del<TagType>(`${BASE}/${id}`);
}
