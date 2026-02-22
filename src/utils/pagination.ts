import { StatusMap, t } from "elysia";

const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = t.Object({
  page: t.String({ default: '1' }),
  pageSize: t.String({ default: '10' }),
});

export const searchQuerySchema = t.Object({
  q: t.String({ minLength: 1 }),
  page: t.String({ default: '1' }),
  pageSize: t.String({ default: '10' }),
});

type PaginationQuery = {
  page: string;
  pageSize: string;
};

type SearchQuery = PaginationQuery & {
  q: string;
};

type SetStatus = {
  status?: number | keyof StatusMap;
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

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
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
  };
};
