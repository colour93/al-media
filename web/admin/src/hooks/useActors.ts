import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchActorsList,
  searchActors,
  fetchActor,
  createActor,
  updateActor,
  deleteActor,
} from '../api/actors';
import { useSnackbar } from './useSnackbar';

const KEYS = {
  list: (page: number, pageSize: number, keyword: string, sortBy?: string, sortOrder?: 'asc' | 'desc') =>
    ['actors', 'list', page, pageSize, keyword, sortBy, sortOrder] as const,
  detail: (id: number) => ['actors', 'detail', id] as const,
};

export function useActorsList(
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
        ? searchActors(keyword.trim(), page, pageSize, sortBy, sortOrder)
        : fetchActorsList(page, pageSize, sortBy, sortOrder),
  });
}

export function useActor(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => fetchActor(id!),
    enabled: id != null,
  });
}

export function useActorCreate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (data: { name: string; avatarKey?: string; tags?: number[] }) => createActor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actors'] });
      showMessage('创建成功');
    },
    onError: (err: Error) => showError(err?.message ?? '创建失败'),
  });
}

export function useActorUpdate() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; avatarKey?: string; tags?: number[] };
    }) => updateActor(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['actors'] });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      showMessage('更新成功');
    },
    onError: (err: Error) => showError(err?.message ?? '更新失败'),
  });
}

export function useActorDelete() {
  const qc = useQueryClient();
  const { showError, showMessage } = useSnackbar();

  return useMutation({
    mutationFn: (id: number) => deleteActor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actors'] });
      showMessage('删除成功');
    },
    onError: (err: Error) => showError(err?.message ?? '删除失败'),
  });
}
