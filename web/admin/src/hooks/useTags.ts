import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTagsList, searchTags, fetchTag, createTag, updateTag, deleteTag } from '../api/tags';
import type { TagWithType } from '../api/tags';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string, sortBy?: string, sortOrder?: 'asc' | 'desc') =>
    ['tags', 'list', page, pageSize, keyword, sortBy, sortOrder] as const,
  detail: (id: number) => ['tags', 'detail', id] as const,
};

export function useTagsList(
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
        ? searchTags(keyword.trim(), page, pageSize, sortBy, sortOrder)
        : fetchTagsList(page, pageSize, sortBy, sortOrder),
  });
}

export function useTag(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchTag(id!),
    enabled: id != null,
  });
}

export function useTagCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: { name: string; tagTypeId: number; color?: string }) => createTag(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useTagUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; tagTypeId?: number; color?: string };
    }) => updateTag(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useTagDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}
