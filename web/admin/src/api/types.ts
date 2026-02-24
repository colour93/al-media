export interface PaginatedResult<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface TagType {
  id: number;
  name: string;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: number;
  name: string;
  tagTypeId: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileDir {
  id: number;
  path: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FileCategory = 'avatars' | 'thumbnails' | 'misc';

export interface Actor {
  id: number;
  name: string;
  avatarKey: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export type CreatorType = 'person' | 'group';

export type CreatorPlatform = 'onlyfans' | 'justforfans' | 'fansone' | 'fansonly';

export interface Creator {
  id: number;
  name: string;
  type: CreatorType;
  actorId: number | null;
  platform: CreatorPlatform | null;
  platformId: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export interface Distributor {
  id: number;
  name: string;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoFile {
  id: number;
  fileDirId: number;
  fileKey: string;
  uniqueId: string;
  fileSize: number;
  fileModifiedAt: string;
  videoDuration: number;
  createdAt: string;
  updatedAt: string;
  video?: Video | null;
  fileDir?: { id: number; path: string } | null;
  /** 缩略图 key，优先使用关联视频的，否则为 {uniqueId}.jpg */
  thumbnailKey?: string | null;
}

export interface Video {
  id: number;
  title: string;
  thumbnailKey: string | null;
  isFeatured?: boolean;
  isBanner?: boolean;
  bannerOrder?: number | null;
  recommendedOrder?: number | null;
  createdAt: string;
  updatedAt: string;
}
