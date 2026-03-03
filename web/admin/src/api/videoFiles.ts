import { del, get, post, put } from './client';
import type { PaginatedResult } from './types';
import type {
  ApplyVideoFileIndexStrategyResult,
  CursorListResult,
  VideoFile,
  VideoFileFolderItem,
  VideoFileIndexStrategy,
  VideoReencodeTask,
  VideoFileScanTask,
} from './types';

const BASE = '/video-files';
export type VideoFileWebCompatibilityFilter = 'all' | 'compatible' | 'incompatible';
export type VideoFileHasVideoFilter = 'all' | 'bound' | 'unbound';
export type VideoFileListFilters = {
  webCompatibility?: VideoFileWebCompatibilityFilter;
  hasVideo?: VideoFileHasVideoFilter;
  fileDirId?: number;
};

export async function fetchVideoFilesList(
  page: number,
  pageSize: number,
  filters: VideoFileListFilters = {},
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFile>> {
  const params: Record<string, string | number> = { page, pageSize };
  const webCompatibility = filters.webCompatibility ?? 'all';
  const hasVideo = filters.hasVideo ?? 'all';
  if (webCompatibility !== 'all') params.webCompatibility = webCompatibility;
  if (hasVideo !== 'all') params.hasVideo = hasVideo;
  if (typeof filters.fileDirId === 'number') params.fileDirId = filters.fileDirId;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFile>>(BASE, params);
}

export async function searchVideoFiles(
  keyword: string,
  page: number,
  pageSize: number,
  filters: VideoFileListFilters = {},
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoFile>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  const webCompatibility = filters.webCompatibility ?? 'all';
  const hasVideo = filters.hasVideo ?? 'all';
  if (webCompatibility !== 'all') params.webCompatibility = webCompatibility;
  if (hasVideo !== 'all') params.hasVideo = hasVideo;
  if (typeof filters.fileDirId === 'number') params.fileDirId = filters.fileDirId;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoFile>>(`${BASE}/search`, params);
}

export async function fetchVideoFile(id: number): Promise<VideoFile> {
  return get<VideoFile>(`${BASE}/${id}`);
}

export async function fetchVideoFileFolderChildren(params: {
  fileDirId: number;
  folderPath?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<CursorListResult<VideoFileFolderItem>> {
  const query: Record<string, string | number> = {
    fileDirId: params.fileDirId,
    pageSize: params.pageSize ?? 50,
  };
  if (params.folderPath) query.folderPath = params.folderPath;
  if (params.cursor) query.cursor = params.cursor;
  return get<CursorListResult<VideoFileFolderItem>>(`${BASE}/folders/children`, query);
}

export async function fetchVideoFilesByFolder(params: {
  fileDirId: number;
  folderPath?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<CursorListResult<VideoFile>> {
  const query: Record<string, string | number> = {
    fileDirId: params.fileDirId,
    pageSize: params.pageSize ?? 50,
  };
  if (params.folderPath) query.folderPath = params.folderPath;
  if (params.cursor) query.cursor = params.cursor;
  return get<CursorListResult<VideoFile>>(`${BASE}/folders/files`, query);
}

export async function fetchVideoFileScanTask(): Promise<VideoFileScanTask | null> {
  return get<VideoFileScanTask | null>(`${BASE}/scan-task`);
}

export async function fetchVideoReencodeTask(): Promise<VideoReencodeTask> {
  return get<VideoReencodeTask>(`${BASE}/reencode-task`);
}

export async function enqueueVideoReencodeTask(videoFileId: number): Promise<VideoReencodeTask> {
  return post<VideoReencodeTask>(`${BASE}/reencode`, { videoFileId });
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
