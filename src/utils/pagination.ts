import { StatusMap, t } from "elysia";

const MAX_PAGE_SIZE = 100;

const sortOrderSchema = t.Union([t.Literal("asc"), t.Literal("desc")]);

export const paginationQuerySchema = t.Object({
  page: t.String({ default: '1' }),
  pageSize: t.String({ default: '10' }),
  sortBy: t.Optional(t.String()),
  sortOrder: t.Optional(sortOrderSchema),
});

export const searchQuerySchema = t.Object({
  q: t.String({ minLength: 1 }),
  page: t.String({ default: '1' }),
  pageSize: t.String({ default: '10' }),
  sortBy: t.Optional(t.String()),
  sortOrder: t.Optional(sortOrderSchema),
});

type PaginationQuery = {
  page: string;
  pageSize: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

type SearchQuery = PaginationQuery & {
  q: string;
};

type SetStatus = {
  status?: number | keyof StatusMap;
};

export type SortParams = {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export const parsePagination = (query: PaginationQuery, set: SetStatus) => {
  const page = Number(query.page);
  const pageSize = Number(query.pageSize);

  if (!Number.isInteger(page) || page < 1) {
    set.status = 400;
    return null;
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    set.status = 400;
    return null;
  }

  const sortOrder = query.sortOrder === "asc" || query.sortOrder === "desc" ? query.sortOrder : undefined;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    sortBy: query.sortBy?.trim() || undefined,
    sortOrder,
  };
};

export type PaginatedResult<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

export const parseSearchQuery = (query: SearchQuery, set: SetStatus) => {
  const pagination = parsePagination(query, set);
  if (!pagination) {
    return null;
  }

  const keyword = query.q.trim();
  if (!keyword) {
    set.status = 400;
    return null;
  }

  return {
    ...pagination,
    keyword,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
  };
};
