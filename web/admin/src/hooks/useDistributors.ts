import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDistributorsList,
  searchDistributors,
  fetchDistributor,
  createDistributor,
  updateDistributor,
  deleteDistributor,
} from '../api/distributors';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string) =>
    ['distributors', 'list', page, pageSize, keyword] as const,
  detail: (id: number) => ['distributors', 'detail', id] as const,
};

export function useDistributorsList(page: number, pageSize: number, keyword: string) {
  return useQuery({
    queryKey: KEYS.list(page, pageSize, keyword),
    queryFn: () =>
      keyword.trim()
        ? searchDistributors(keyword.trim(), page, pageSize)
        : fetchDistributorsList(page, pageSize),
  });
}

export function useDistributor(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchDistributor(id!),
    enabled: id != null,
  });
}

export function useDistributorCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: { name: string; domain?: string }) => createDistributor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributors'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useDistributorUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: { id: number; data: { name?: string; domain?: string } }) =>
      updateDistributor(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['distributors'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useDistributorDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteDistributor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributors'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}
