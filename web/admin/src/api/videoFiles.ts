import { del, get, post, put } from './client';
import type { PaginatedResult } from './types';
import type {
  ApplyVideoFileIndexStrategyResult,
  VideoFile,
  VideoFileIndexStrategy,
  VideoFileScanTask,
} from './types';

const BASE = '/video-files';

export async function fetchVideoFilesList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFile>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFile>>(BASE, params);
}

export async function searchVideoFiles(
  keyword: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFile>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFile>>(`${BASE}/search`, params);
}

export async function fetchVideoFile(id: number): Promise<VideoFile> {
  return get<VideoFile>(`${BASE}/${id}`);
}

export async function fetchVideoFileScanTask(): Promise<VideoFileScanTask | null> {
  return get<VideoFileScanTask | null>(`${BASE}/scan-task`);
}

export async function startVideoFileScanTask(data: {
  fileDirId: number;
  force?: boolean;
}): Promise<VideoFileScanTask | null> {
  return post<VideoFileScanTask | null>(`${BASE}/scan/start`, data);
}

export async function pauseVideoFileScanTask(): Promise<VideoFileScanTask | null> {
  return post<VideoFileScanTask | null>(`${BASE}/scan/pause`);
}

export async function resumeVideoFileScanTask(): Promise<VideoFileScanTask | null> {
  return post<VideoFileScanTask | null>(`${BASE}/scan/resume`);
}

export async function stopVideoFileScanTask(): Promise<VideoFileScanTask | null> {
  return post<VideoFileScanTask | null>(`${BASE}/scan/stop`);
}

export async function cancelVideoFileScanTask(): Promise<VideoFileScanTask | null> {
  return post<VideoFileScanTask | null>(`${BASE}/scan/cancel`);
}

export type CreateVideoFileIndexStrategyInput = {
  mode?: 'blacklist';
  fileDirId?: number | null;
  fileKeyRegex: string;
  enabled?: boolean;
};

export type UpdateVideoFileIndexStrategyInput = {
  mode?: 'blacklist';
  fileDirId?: number | null;
  fileKeyRegex?: string;
  enabled?: boolean;
};

export async function fetchVideoFileIndexStrategiesList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFileIndexStrategy>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFileIndexStrategy>>(`${BASE}/index-strategies`, params);
}

export async function searchVideoFileIndexStrategies(
  keyword: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFileIndexStrategy>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFileIndexStrategy>>(`${BASE}/index-strategies/search`, params);
}

export async function fetchVideoFileIndexStrategy(id: number): Promise<VideoFileIndexStrategy> {
  return get<VideoFileIndexStrategy>(`${BASE}/index-strategies/${id}`);
}

export async function createVideoFileIndexStrategy(
  data: CreateVideoFileIndexStrategyInput
): Promise<VideoFileIndexStrategy> {
  return post<VideoFileIndexStrategy>(`${BASE}/index-strategies`, data);
}

export async function updateVideoFileIndexStrategy(
  id: number,
  data: UpdateVideoFileIndexStrategyInput
): Promise<VideoFileIndexStrategy> {
  return put<VideoFileIndexStrategy>(`${BASE}/index-strategies/${id}`, data);
}

export async function deleteVideoFileIndexStrategy(id: number): Promise<VideoFileIndexStrategy> {
  return del<VideoFileIndexStrategy>(`${BASE}/index-strategies/${id}`);
}

export async function applyVideoFileIndexStrategy(
  id: number
): Promise<ApplyVideoFileIndexStrategyResult> {
  return post<ApplyVideoFileIndexStrategyResult>(`${BASE}/index-strategies/${id}/apply`);
}
