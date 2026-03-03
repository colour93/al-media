import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCreatorsList,
  searchCreators,
  fetchCreator,
  createCreator,
  updateCreator,
  deleteCreatorWithOptions,
  mergeCreators,
} from '../api/creators';
import type { CreatorType, CreatorPlatform } from '../api/types';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string, sortBy?: string, sortOrder?: 'asc' | 'desc') =>
    ['creators', 'list', page, pageSize, keyword, sortBy, sortOrder] as const,
  detail: (id: number) => ['creators', 'detail', id] as const,
};

export function useCreatorsList(
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
        ? searchCreators(keyword.trim(), page, pageSize, sortBy, sortOrder)
        : fetchCreatorsList(page, pageSize, sortBy, sortOrder),
  });
}

export function useCreator(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchCreator(id!),
    enabled: id != null,
  });
}

export function useCreatorCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: {
      name: string;
      type: CreatorType;
      actorId?: number | null;
      platform?: CreatorPlatform | null;
      platformId?: string | null;
      tags?: number[];
    }) => createCreator(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creators'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useCreatorUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        name?: string;
        type?: CreatorType;
        actorId?: number | null;
        platform?: CreatorPlatform | null;
        platformId?: string | null;
        tags?: number[];
      };
    }) => updateCreator(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['creators'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useCreatorDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (input: number | { id: number; force?: boolean }) => {
      if (typeof input === 'number') {
        return deleteCreatorWithOptions(input);
      }
      return deleteCreatorWithOptions(input.id, { force: input.force });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creators'] });
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['bindingStrategies'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}

export function useCreatorMerge() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({ targetId, sourceIds }: { targetId: number; sourceIds: number[] }) =>
      mergeCreators(targetId, sourceIds),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['creators'] });
      qc.invalidateQueries({ queryKey: ['bindingStrategies'] });
      qc.invalidateQueries({ queryKey: ['videos'] });
      showMessage(`合并完成：移除 ${result.removed} 个创作者，迁移 ${result.movedRefs} 条关联`);
    },
    onError: (err: Error) => showError(err?.message ?? '合并失败'),
  });
}
