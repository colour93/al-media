import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { Distributor } from './types';

const BASE = '/distributors';

export async function fetchDistributorsList(
  page: number,
  pageSize: number
): Promise<PaginatedResult<Distributor>> {
  return get<PaginatedResult<Distributor>>(BASE, { page, pageSize });
}

export async function searchDistributors(
  keyword: string,
  page: number,
  pageSize: number
): Promise<PaginatedResult<Distributor>> {
  return get<PaginatedResult<Distributor>>(`${BASE}/search`, { q: keyword, page, pageSize });
}

export async function fetchDistributor(id: number): Promise<Distributor> {
  return get<Distributor>(`${BASE}/${id}`);
}

export async function createDistributor(data: {
  name: string;
  domain?: string;
}): Promise<Distributor> {
  return post<Distributor>(BASE, data);
}

export async function updateDistributor(
  id: number,
  data: { name?: string; domain?: string }
): Promise<Distributor> {
  return patch<Distributor>(`${BASE}/${id}`, data);
}

export async function deleteDistributor(id: number): Promise<Distributor> {
  return del<Distributor>(`${BASE}/${id}`);
}
