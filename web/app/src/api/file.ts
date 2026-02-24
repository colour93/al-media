import { API_BASE } from '../config/api';

/** 获取缩略图 URL（复用 admin file 路由） */
export function getThumbnailUrl(thumbnailKey: string | null): string {
  if (!thumbnailKey) return '';
  return `${API_BASE}/admin/file/thumbnails/${thumbnailKey}`;
}

/** 获取头像等文件 URL（复用 admin file 路由） */
export function getFileUrl(category: 'avatars' | 'thumbnails' | 'misc', key: string): string {
  if (!key) return '';
  return `${API_BASE}/admin/file/${category}/${key}`;
}
