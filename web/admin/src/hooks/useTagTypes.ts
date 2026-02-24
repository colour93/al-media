import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTagTypesList,
  searchTagTypes,
  fetchTagType,
  createTagType,
  updateTagType,
  deleteTagType,
} from '../api/tagTypes';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string) =>
    ['tagTypes', 'list', page, pageSize, keyword] as const,
  detail: (id: number) => ['tagTypes', 'detail', id] as const,
};

export function useTagTypesList(page: number, pageSize: number, keyword: string) {
  return useQuery({
    queryKey: KEYS.list(page, pageSize, keyword),
    queryFn: () =>
      keyword.trim()
        ? searchTagTypes(keyword.trim(), page, pageSize)
        : fetchTagTypesList(page, pageSize),
  });
}

export function useTagType(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchTagType(id!),
    enabled: id != null,
  });
}

export function useTagTypeCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: { name: string; icon?: string }) => createTagType(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tagTypes'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useTagTypeUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; icon?: string };
    }) => updateTagType(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tagTypes'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useTagTypeDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteTagType(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tagTypes'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}
