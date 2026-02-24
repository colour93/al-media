export interface ListSearchParams {
  page: number;
  pageSize: number;
  keyword: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  editId?: number;
}

const defaults: Omit<ListSearchParams, 'editId' | 'sortBy' | 'sortOrder'> = {
  page: 1,
  pageSize: 10,
  keyword: '',
};

export function validateListSearch(search: Record<string, unknown>): ListSearchParams {
  const page = Number(search?.page);
  const pageSize = Number(search?.pageSize);
  const editIdRaw = search?.editId;
  const editId =
    typeof editIdRaw === 'number' && Number.isInteger(editIdRaw) && editIdRaw >= 1
      ? editIdRaw
      : typeof editIdRaw === 'string'
        ? (() => {
            const n = Number(editIdRaw);
            return Number.isInteger(n) && n >= 1 ? n : undefined;
          })()
        : undefined;
  const sortOrderRaw = search?.sortOrder;
  const sortOrder =
    sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : undefined;
  const sortBy =
    typeof search?.sortBy === 'string' && search.sortBy.trim() ? search.sortBy.trim() : undefined;
  return {
    page: Number.isInteger(page) && page >= 1 ? page : defaults.page,
    pageSize: Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : defaults.pageSize,
    keyword: typeof search?.keyword === 'string' ? search.keyword : defaults.keyword,
    sortBy,
    sortOrder,
    editId,
  };
}
