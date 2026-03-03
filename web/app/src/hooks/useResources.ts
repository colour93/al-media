import { useQuery } from '@tanstack/react-query';
import { fetchResourceSearch, fetchResourceTagOptions } from '../api/resources';
import type { ResourceCategory } from '../api/types';

export function useResourceSearch(params: {
  q?: string;
  category?: ResourceCategory;
  page?: number;
  pageSize?: number;
  includeTagIds?: number[];
  excludeTagIds?: number[];
}) {
  const includeKey = (params.includeTagIds ?? []).slice().sort((a, b) => a - b).join(',');
  const excludeKey = (params.excludeTagIds ?? []).slice().sort((a, b) => a - b).join(',');

  return useQuery({
    queryKey: [
      'common',
      'resources',
      'search',
      params.q ?? '',
      params.category ?? 'all',
      params.page ?? 1,
      params.pageSize ?? 12,
      includeKey,
      excludeKey,
    ],
    queryFn: () => fetchResourceSearch(params),
  });
}

export function useResourceTagOptions(q: string, pageSize = 30) {
  return useQuery({
    queryKey: ['common', 'resources', 'tags', q, pageSize],
    queryFn: () => fetchResourceTagOptions(q || undefined, 1, pageSize),
  });
}
