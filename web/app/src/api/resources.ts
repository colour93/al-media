import { get } from './client';
import type { PaginatedResult, ResourceCategory, ResourceSearchResult, SearchTag } from './types';

const BASE = '/resources';

export interface FetchResourceSearchParams {
  q?: string;
  category?: ResourceCategory;
  page?: number;
  pageSize?: number;
  includeTagIds?: number[];
  excludeTagIds?: number[];
}

function toCsv(ids?: number[]): string | undefined {
  if (!ids || ids.length === 0) return undefined;
  const values = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  return values.length > 0 ? values.join(',') : undefined;
}

export async function fetchResourceSearch(params: FetchResourceSearchParams): Promise<ResourceSearchResult> {
  const query: Record<string, string | number | undefined> = {
    q: params.q,
    category: params.category,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 12,
    includeTagIds: toCsv(params.includeTagIds),
    excludeTagIds: toCsv(params.excludeTagIds),
  };
  return get<ResourceSearchResult>(`${BASE}/search`, query);
}

export async function fetchResourceTagOptions(
  q: string | undefined,
  page = 1,
  pageSize = 30
): Promise<PaginatedResult<SearchTag>> {
  return get<PaginatedResult<SearchTag>>(`${BASE}/tags`, {
    q,
    page,
    pageSize,
  });
}
