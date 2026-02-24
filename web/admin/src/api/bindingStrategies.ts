import { get, post, put, del } from './client';
import type { PaginatedResult } from './types';
import type { BindingStrategy } from './types';

const BASE = '/binding-strategies';

export type CreateBindingStrategyInput = {
  type: 'folder' | 'regex';
  fileDirId: number;
  folderPath?: string | null;
  filenameRegex?: string | null;
  tagIds?: number[];
  creatorIds?: number[];
  actorIds?: number[];
  enabled?: boolean;
};

export type UpdateBindingStrategyInput = {
  type?: 'folder' | 'regex';
  fileDirId?: number;
  folderPath?: string | null;
  filenameRegex?: string | null;
  tagIds?: number[];
  creatorIds?: number[];
  actorIds?: number[];
  enabled?: boolean;
};

export type ApplyStrategyResult = {
  applied: number;
  videoIds: number[];
};

export async function fetchBindingStrategiesList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<BindingStrategy>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<BindingStrategy>>(BASE, params);
}

export async function fetchBindingStrategy(id: number): Promise<BindingStrategy> {
  return get<BindingStrategy>(`${BASE}/${id}`);
}

export async function createBindingStrategy(
  data: CreateBindingStrategyInput
): Promise<BindingStrategy> {
  return post<BindingStrategy>(BASE, data);
}

export async function updateBindingStrategy(
  id: number,
  data: UpdateBindingStrategyInput
): Promise<BindingStrategy> {
  return put<BindingStrategy>(`${BASE}/${id}`, data);
}

export async function deleteBindingStrategy(id: number): Promise<BindingStrategy> {
  return del<BindingStrategy>(`${BASE}/${id}`);
}

export async function applyStrategy(id: number): Promise<ApplyStrategyResult> {
  return post<ApplyStrategyResult>(`${BASE}/${id}/apply`);
}
