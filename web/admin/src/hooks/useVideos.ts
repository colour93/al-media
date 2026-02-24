import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchVideosList,
  searchVideos,
  fetchVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  insertFromVideoFile,
  reExtractVideoInfo,
} from '../api/videos';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string, sortBy?: string, sortOrder?: 'asc' | 'desc') =>
    ['videos', 'list', page, pageSize, keyword, sortBy, sortOrder] as const,
  detail: (id: number) => ['videos', 'detail', id] as const,
};

export function useVideosList(
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
        ? searchVideos(keyword.trim(), page, pageSize, sortBy, sortOrder)
        : fetchVideosList(page, pageSize, sortBy, sortOrder),
  });
}

export function useVideo(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchVideo(id!),
    enabled: id != null,
  });
}

export function useVideoCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: {
      title: string;
      thumbnailKey?: string;
      actors?: number[];
      creators?: number[];
      distributors?: number[];
      tags?: number[];
    }) => createVideo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useVideoUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        title?: string;
        thumbnailKey?: string;
        actors?: number[];
        creators?: number[];
        distributors?: number[];
        tags?: number[];
      };
    }) => updateVideo(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useVideoDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteVideo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}

export function useVideoInsertFromFile() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: { videoFileId: number; autoExtract?: boolean }) =>
      insertFromVideoFile(data),
    onSuccess: (video) => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['videoFiles'] });
      showMessage('视频创建成功');
      return video;
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useVideoReExtract() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => reExtractVideoInfo(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('重新推断完成');
    },
    onError: (err: Error) => showError(err?.message ?? '重新推断失败'),
  });
}
