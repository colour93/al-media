import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFileDirsList,
  searchFileDirs,
  fetchFileDir,
  createFileDir,
  updateFileDir,
  deleteFileDir,
} from '../api/fileDirs';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string) =>
    ['fileDirs', 'list', page, pageSize, keyword] as const,
  detail: (id: number) => ['fileDirs', 'detail', id] as const,
};

export function useFileDirsList(page: number, pageSize: number, keyword: string) {
  return useQuery({
    queryKey: KEYS.list(page, pageSize, keyword),
    queryFn: () =>
      keyword.trim()
        ? searchFileDirs(keyword.trim(), page, pageSize)
        : fetchFileDirsList(page, pageSize),
  });
}

export function useFileDir(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchFileDir(id!),
    enabled: id != null,
  });
}

export function useFileDirCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: { path: string; enabled?: boolean }) => createFileDir(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileDirs'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useFileDirUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => updateFileDir(id, { enabled }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['fileDirs'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useFileDirDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteFileDir(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileDirs'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}
