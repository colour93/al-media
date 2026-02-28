import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchVideosList,
  fetchVideo,
  fetchRecommended,
  fetchBanner,
  fetchLatest,
  fetchVideoInteractionState,
  setVideoFavorite,
  upsertVideoHistory,
  fetchFavoriteVideos,
  fetchWatchHistory,
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

export function useVideoInteraction(videoId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['common', 'videos', 'interaction', videoId],
    queryFn: () => fetchVideoInteractionState(videoId!),
    enabled: enabled && videoId != null,
  });
}

export function useFavoriteVideos(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: ['common', 'videos', 'favorites', page, pageSize],
    queryFn: () => fetchFavoriteVideos(page, pageSize),
    enabled,
  });
}

export function useWatchHistory(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: ['common', 'videos', 'history', page, pageSize],
    queryFn: () => fetchWatchHistory(page, pageSize),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useSetVideoFavorite(videoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (favorite: boolean) => setVideoFavorite(videoId, favorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['common', 'videos', 'interaction', videoId] });
      queryClient.invalidateQueries({ queryKey: ['common', 'videos', 'favorites'] });
    },
  });
}

export function useUpsertVideoHistory(videoId: number, options?: { invalidateAfterSuccess?: boolean }) {
  const queryClient = useQueryClient();
  const shouldInvalidate = options?.invalidateAfterSuccess ?? true;
  return useMutation({
    mutationFn: (payload: { progressSeconds: number; durationSeconds?: number; completed?: boolean }) =>
      upsertVideoHistory(videoId, payload),
    onSuccess: () => {
      if (!shouldInvalidate) return;
      queryClient.invalidateQueries({ queryKey: ['common', 'videos', 'interaction', videoId] });
      queryClient.invalidateQueries({ queryKey: ['common', 'videos', 'history'] });
    },
  });
}
