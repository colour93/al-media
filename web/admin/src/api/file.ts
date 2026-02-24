import { get, post } from './client';
import { ADMIN_API } from '../config/api';
import type { FileCategory } from './types';

const BASE = '/file';

export interface VideoSignResult {
  url: string;
}

export async function getVideoSignUrl(videoFileId: number): Promise<VideoSignResult> {
  return get<VideoSignResult>(`${BASE}/video/${videoFileId}/sign`);
}

export interface UploadResult {
  key: string;
}

export async function uploadFile(file: File, category: FileCategory): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  return post<UploadResult>(BASE, formData);
}

export function getFileUrl(
  category: FileCategory,
  key: string,
  cacheBuster?: number
): string {
  const base = `${ADMIN_API}${BASE}/${category}/${key}`;
  return cacheBuster != null ? `${base}?t=${cacheBuster}` : base;
}
