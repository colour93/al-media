import { get, post, patch, del } from './client';
import type { PaginatedResult } from './types';
import type { Video } from './types';

const BASE = '/videos';

export interface VideoDetail extends Video {
  actors?: { id: number; name: string }[];
  creators?: { id: number; name: string }[];
  distributors?: { id: number; name: string }[];
  tags?: { id: number; name: string }[];
  videoFileUrl?: string | null;
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
