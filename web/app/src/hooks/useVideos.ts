import { useQuery } from '@tanstack/react-query';
import {
  fetchVideosList,
  fetchVideo,
  fetchRecommended,
  fetchBanner,
  fetchLatest,
} from '../api/videos';

export function useVideosList(
  page: number,
  pageSize: number,
  params?: { q?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }
) {
  return useQuery({
    queryKey: ['common', 'videos', 'list', page, pageSize, params?.q, params?.sortBy, params?.sortOrder],
    queryFn: () => fetchVideosList(page, pageSize, params),
  });
}

export function useVideo(id: number | null) {
  return useQuery({
    queryKey: ['common', 'videos', 'detail', id],
    queryFn: () => fetchVideo(id!),
    enabled: id != null,
  });
}

export function useRecommended() {
  return useQuery({
    queryKey: ['common', 'videos', 'recommended'],
    queryFn: fetchRecommended,
  });
}

export function useBanner() {
  return useQuery({
    queryKey: ['common', 'videos', 'banner'],
    queryFn: fetchBanner,
  });
}

export function useLatest(page: number, pageSize: number) {
  return useQuery({
    queryKey: ['common', 'videos', 'latest', page, pageSize],
    queryFn: () => fetchLatest(page, pageSize),
  });
}
