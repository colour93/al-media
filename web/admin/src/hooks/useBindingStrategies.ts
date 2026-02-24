import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBindingStrategiesList,
  fetchBindingStrategy,
  createBindingStrategy,
  updateBindingStrategy,
  deleteBindingStrategy,
  applyStrategy,
  type CreateBindingStrategyInput,
  type UpdateBindingStrategyInput,
} from '../api/bindingStrategies';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, sortBy?: string, sortOrder?: string) =>
    ['bindingStrategies', 'list', page, pageSize, sortBy, sortOrder] as const,
  detail: (id: number) => ['bindingStrategies', 'detail', id] as const,
};

export function useBindingStrategiesList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
) {
  return useQuery({
    queryKey: KEYS.list(page, pageSize, sortBy, sortOrder),
    queryFn: () =>
      fetchBindingStrategiesList(page, pageSize, sortBy, sortOrder),
  });
}

export function useBindingStrategy(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchBindingStrategy(id!),
    enabled: id != null,
  });
}

export function useBindingStrategyCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: CreateBindingStrategyInput) => createBindingStrategy(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bindingStrategies'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useBindingStrategyUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBindingStrategyInput }) =>
      updateBindingStrategy(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['bindingStrategies'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useBindingStrategyDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteBindingStrategy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bindingStrategies'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}

export function useApplyStrategy() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => applyStrategy(id),
    onSuccess: (data, id) => {
      qc.invalidateQueries({ queryKey: ['bindingStrategies'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage(`已应用策略，影响 ${data.videoIds.length} 个视频，新增 ${data.applied} 条绑定`);
    },
    onError: (err: Error) => showError(err?.message ?? '应用策略失败'),
  });
}
