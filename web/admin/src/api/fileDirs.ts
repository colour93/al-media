import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { FileDir } from './types';

const BASE = '/file-dirs';

export async function fetchFileDirsList(
  page: number,
  pageSize: number
): Promise<PaginatedResult<FileDir>> {
  return get<PaginatedResult<FileDir>>(BASE, { page, pageSize });
}

export async function searchFileDirs(
  keyword: string,
  page: number,
  pageSize: number
): Promise<PaginatedResult<FileDir>> {
  return get<PaginatedResult<FileDir>>(`${BASE}/search`, { q: keyword, page, pageSize });
}

export async function fetchFileDir(id: number): Promise<FileDir> {
  return get<FileDir>(`${BASE}/${id}`);
}

export async function createFileDir(data: { path: string; enabled?: boolean }): Promise<FileDir> {
  return post<FileDir>(BASE, data);
}

export async function updateFileDir(id: number, data: { enabled: boolean }): Promise<FileDir> {
  return patch<FileDir>(`${BASE}/${id}`, data);
}

export async function deleteFileDir(id: number): Promise<FileDir> {
  return del<FileDir>(`${BASE}/${id}`);
}
