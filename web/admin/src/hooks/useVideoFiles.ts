import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyVideoFileIndexStrategy,
  cancelVideoFileScanTask,
  createVideoFileIndexStrategy,
  deleteVideoFile,
  deleteVideoFileReencodeSource,
  deleteVideoFileIndexStrategy,
  enqueueVideoReencodeTask,
  enqueueAllVideoReencodeTasks,
  fetchVideoFileDuplicateGroups,
  fetchVideoFilesList,
  fetchVideoFileIndexStrategiesList,
  fetchVideoReencodeTask,
  fetchVideoFileScanTask,
  searchVideoFiles,
  searchVideoFileIndexStrategies,
  pauseVideoFileScanTask,
  resumeVideoFileScanTask,
  startVideoFileScanTask,
  stopVideoFileScanTask,
  updateVideoFileIndexStrategy,
  fetchVideoFile,
  type VideoFileListFilters,
  type VideoFileWebCompatibilityFilter,
  type CreateVideoFileIndexStrategyInput,
  type UpdateVideoFileIndexStrategyInput,
} from '../api/videoFiles';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (
    page: number,
    pageSize: number,
    keyword: string,
    webCompatibility: VideoFileWebCompatibilityFilter,
    hasVideo: 'all' | 'bound' | 'unbound',
    fileDirId: number | null,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ) => ['videoFiles', 'list', page, pageSize, keyword, webCompatibility, hasVideo, fileDirId, sortBy, sortOrder] as const,
  detail: (id: number) => ['videoFiles', 'detail', id] as const,
  scanTask: () => ['videoFiles', 'scanTask'] as const,
  reencodeTask: () => ['videoFiles', 'reencodeTask'] as const,
  duplicateGroups: (page: number, pageSize: number) =>
    ['videoFiles', 'duplicateGroups', page, pageSize] as const,
  indexStrategies: (
    page: number,
    pageSize: number,
    keyword: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ) => ['videoFiles', 'indexStrategies', page, pageSize, keyword, sortBy, sortOrder] as const,
  indexStrategyDetail: (id: number) => ['videoFiles', 'indexStrategyDetail', id] as const,
};

export function useVideoFilesList(
  page: number,
  pageSize: number,
  keyword: string,
  filters: VideoFileListFilters,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
) {
  const webCompatibility = filters.webCompatibility ?? 'all';
  const hasVideo = filters.hasVideo ?? 'all';
  const fileDirId = filters.fileDirId ?? null;
  return useQuery({
    queryKey: KEYS.list(page, pageSize, keyword, webCompatibility, hasVideo, fileDirId, sortBy, sortOrder),
    queryFn: () =>
      keyword.trim()
        ? searchVideoFiles(keyword.trim(), page, pageSize, filters, sortBy, sortOrder)
        : fetchVideoFilesList(page, pageSize, filters, sortBy, sortOrder),
  });
}

export function useVideoFilesIncompatibleCount(
  keyword: string,
  filters: Omit<VideoFileListFilters, 'webCompatibility'>,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
  enabled = true
) {
  const mergedFilters: VideoFileListFilters = {
    ...filters,
    webCompatibility: 'incompatible',
  };
  return useQuery({
    queryKey: [
      'videoFiles',
      'incompatibleCount',
      keyword.trim(),
      filters.hasVideo ?? 'all',
      filters.fileDirId ?? null,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      keyword.trim()
        ? searchVideoFiles(keyword.trim(), 1, 1, mergedFilters, sortBy, sortOrder)
        : fetchVideoFilesList(1, 1, mergedFilters, sortBy, sortOrder),
    enabled,
  });
}

export function useVideoFile(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchVideoFile(id!),
    enabled: id != null,
  });
}

export function useVideoFileScanTask() {
  return useQuery({
    queryKey: KEYS.scanTask(),
    queryFn: () => fetchVideoFileScanTask(),
    refetchInterval: 1500,
  });
}

export function useVideoReencodeTask() {
  return useQuery({
    queryKey: KEYS.reencodeTask(),
    queryFn: () => fetchVideoReencodeTask(),
    refetchInterval: 1500,
  });
}

export function useStartVideoFileScanTask() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: { fileDirId: number; force?: boolean }) => startVideoFileScanTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videoFiles'] });
      showMessage('索引任务已启动');
    },
    onError: (err: Error) => showError(err?.message ?? '启动索引任务失败'),
  });
}

export function useEnqueueVideoReencodeTask() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (videoFileId: number) => enqueueVideoReencodeTask(videoFileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.reencodeTask() });
      showMessage('已加入重编码队列');
    },
    onError: (err: Error) => showError(err?.message ?? '加入重编码队列失败'),
  });
}

export function useEnqueueAllVideoReencodeTasks() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data?: { deleteSourceAfterSuccess?: boolean }) =>
      enqueueAllVideoReencodeTasks(data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['videoFiles'] });
      qc.invalidateQueries({ queryKey: KEYS.reencodeTask() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      showMessage(
        `批量入队完成（仅兼容风险）：候选 ${result.candidateCount}，入队 ${result.enqueuedCount}，跳过 ${result.skippedCount}`
      );
    },
    onError: (err: Error) => showError(err?.message ?? '批量加入重编码队列失败'),
  });
}

export function useVideoFileDuplicateGroups(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: KEYS.duplicateGroups(page, pageSize),
    queryFn: () => fetchVideoFileDuplicateGroups(page, pageSize),
    enabled,
  });
}

export function useDeleteVideoFile() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteVideoFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videoFiles'] });
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      showMessage('视频文件已删除');
    },
    onError: (err: Error) => showError(err?.message ?? '删除视频文件失败'),
  });
}

export function useDeleteVideoFileReencodeSource() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (outputVideoFileId: number) => deleteVideoFileReencodeSource(outputVideoFileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videoFiles'] });
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: KEYS.reencodeTask() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      showMessage('转码源文件已删除');
    },
    onError: (err: Error) => showError(err?.message ?? '删除转码源文件失败'),
  });
}

function useScanTaskControlMutation(
  mutationFn: () => Promise<unknown>,
  successMessage: string,
  errorMessage: string
) {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.scanTask() });
      showMessage(successMessage);
    },
    onError: (err: Error) => showError(err?.message ?? errorMessage),
  });
}

export function usePauseVideoFileScanTask() {
  return useScanTaskControlMutation(pauseVideoFileScanTask, '索引任务已暂停', '暂停索引任务失败');
}

export function useResumeVideoFileScanTask() {
  return useScanTaskControlMutation(resumeVideoFileScanTask, '索引任务已继续', '继续索引任务失败');
}

export function useStopVideoFileScanTask() {
  return useScanTaskControlMutation(stopVideoFileScanTask, '索引任务已停止', '停止索引任务失败');
}

export function useCancelVideoFileScanTask() {
  return useScanTaskControlMutation(cancelVideoFileScanTask, '索引任务已取消', '取消索引任务失败');
}

export function useVideoFileIndexStrategiesList(
  page: number,
  pageSize: number,
  keyword: string,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
) {
  return useQuery({
    queryKey: KEYS.indexStrategies(page, pageSize, keyword, sortBy, sortOrder),
    queryFn: () =>
      keyword.trim()
        ? searchVideoFileIndexStrategies(keyword.trim(), page, pageSize, sortBy, sortOrder)
        : fetchVideoFileIndexStrategiesList(page, pageSize, sortBy, sortOrder),
  });
}

export function useVideoFileIndexStrategyCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: CreateVideoFileIndexStrategyInput) => createVideoFileIndexStrategy(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videoFiles', 'indexStrategies'] });
      showMessage('索引策略创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建索引策略失败'),
  });
}

export function useVideoFileIndexStrategyUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVideoFileIndexStrategyInput }) =>
      updateVideoFileIndexStrategy(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['videoFiles', 'indexStrategies'] });
      qc.invalidateQueries({ queryKey: KEYS.indexStrategyDetail(id) });
      showMessage('索引策略更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新索引策略失败'),
  });
}

export function useVideoFileIndexStrategyDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteVideoFileIndexStrategy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videoFiles', 'indexStrategies'] });
      showMessage('索引策略删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除索引策略失败'),
  });
}

export function useApplyVideoFileIndexStrategy() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => applyVideoFileIndexStrategy(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['videoFiles', 'indexStrategies'] });
      qc.invalidateQueries({ queryKey: ['videoFiles', 'list'] });
      qc.invalidateQueries({ queryKey: ['videoFiles'] });
      showMessage(`策略已应用，移除 ${result.removed} 条已索引文件`);
    },
    onError: (err: Error) => showError(err?.message ?? '应用索引策略失败'),
  });
}
