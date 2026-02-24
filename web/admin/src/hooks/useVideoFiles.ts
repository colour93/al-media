import { useQuery } from '@tanstack/react-query';
import {
  fetchVideoFilesList,
  searchVideoFiles,
  fetchVideoFile,
} from '../api/videoFiles';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string, sortBy?: string, sortOrder?: 'asc' | 'desc') =>
    ['videoFiles', 'list', page, pageSize, keyword, sortBy, sortOrder] as const,
  detail: (id: number) => ['videoFiles', 'detail', id] as const,
};

export function useVideoFilesList(
  page: number,
  pageSize: number,
  keyword: string,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
) {
  return useQuery({
    queryKey: KEYS.list(page, pageSize, keyword, sortBy, sortOrder),
    queryFn: () =>
      keyword.trim()
        ? searchVideoFiles(keyword.trim(), page, pageSize, sortBy, sortOrder)
        : fetchVideoFilesList(page, pageSize, sortBy, sortOrder),
  });
}

export function useVideoFile(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchVideoFile(id!),
    enabled: id != null,
  });
}
