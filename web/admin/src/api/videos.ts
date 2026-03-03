import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { Video } from './types';
import type { VideoInferTask } from './types';

const BASE = '/videos';

export interface VideoDetail extends Video {
  actors?: { id: number; name: string }[];
  creators?: { id: number; name: string }[];
  distributors?: { id: number; name: string }[];
  tags?: { id: number; name: string }[];
  associatedVideoFiles?: Array<{
    id: number;
    fileDirId: number | null;
    fileDirPath: string | null;
    fileKey: string;
    uniqueId: string;
    fileSize: number;
    videoDuration: number;
    sourceVideoFileId: number | null;
    isPreferred: boolean;
  }>;
  videoFileUrl?: string | null;
  /** 关联 VideoFile 的 fileKey，用于手动提取信息参考 */
  videoFileKey?: string | null;
  /** 视频时长（秒），用于缩略图时间轴 */
  videoDuration?: number;
}

export async function fetchVideosList(
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoDetail>> {
  const params: Record<string, string | number> = { page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoDetail>>(BASE, params);
}

export async function searchVideos(
  keyword: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResult<VideoDetail>> {
  const params: Record<string, string | number> = { q: keyword, page, pageSize };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return get<PaginatedResult<VideoDetail>>(`${BASE}/search`, params);
}

export async function fetchVideo(id: number): Promise<VideoDetail> {
  return get<VideoDetail>(`${BASE}/${id}`);
}

export async function createVideo(data: {
  title: string;
  thumbnailKey?: string;
  actors?: number[];
  creators?: number[];
  distributors?: number[];
  tags?: number[];
}): Promise<Video> {
  return post<Video>(BASE, data);
}

export async function updateVideo(
  id: number,
  data: {
    title?: string;
    thumbnailKey?: string;
    preferredVideoFileId?: number | null;
    actors?: number[];
    creators?: number[];
    distributors?: number[];
    tags?: number[];
    isFeatured?: boolean;
    isBanner?: boolean;
    bannerOrder?: number | null;
    recommendedOrder?: number | null;
  }
): Promise<Video> {
  return patch<Video>(`${BASE}/${id}`, data);
}

export async function deleteVideo(id: number): Promise<Video> {
  return del<Video>(`${BASE}/${id}`);
}

export interface BatchAddTagsResult {
  added: number;
}

export async function batchAddTagsToVideos(
  videoIds: number[],
  tagIds: number[]
): Promise<BatchAddTagsResult> {
  return post<BatchAddTagsResult>(`${BASE}/batch-add-tags`, { videoIds, tagIds });
}

export async function batchAddActorsToVideos(
  videoIds: number[],
  actorIds: number[]
): Promise<{ added: number }> {
  return post<{ added: number }>(`${BASE}/batch-add-actors`, { videoIds, actorIds });
}

export async function batchAddCreatorsToVideos(
  videoIds: number[],
  creatorIds: number[]
): Promise<{ added: number }> {
  return post<{ added: number }>(`${BASE}/batch-add-creators`, { videoIds, creatorIds });
}

export async function insertFromVideoFile(data: {
  videoFileId: number;
  autoExtract?: boolean;
}): Promise<Video> {
  return post<Video>(`${BASE}/insert-from-video-file`, data);
}

export async function reExtractVideoInfo(id: number): Promise<VideoDetail> {
  return post<VideoDetail>(`${BASE}/${id}/re-extract`, {});
}

export async function fetchVideoInferTask(): Promise<VideoInferTask> {
  return get<VideoInferTask>(`${BASE}/infer-task/status`);
}

export async function pauseVideoInferTask(): Promise<VideoInferTask> {
  return post<VideoInferTask>(`${BASE}/infer-task/pause`, {});
}

export async function resumeVideoInferTask(): Promise<VideoInferTask> {
  return post<VideoInferTask>(`${BASE}/infer-task/resume`, {});
}

export async function captureThumbnail(
  id: number,
  seekSec?: number,
  options?: { replaceExisting?: boolean }
): Promise<{ thumbnailKey: string }> {
  return post<{ thumbnailKey: string }>(`${BASE}/${id}/capture-thumbnail`, {
    seekSec,
    replaceExisting: options?.replaceExisting,
  });
}
