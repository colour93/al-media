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

export type BindingStrategyType = 'folder' | 'regex';

export interface BindingStrategy {
  id: number;
  type: BindingStrategyType;
  fileDirId: number;
  folderPath: string | null;
  filenameRegex: string | null;
  tagIds: number[];
  creatorIds: number[];
  actorIds: number[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  fileDir?: FileDir;
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

export type VideoFileScanTaskStatus =
  | 'pending'
  | 'paused'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'stopped';

export interface VideoFileScanTask {
  dir: { id: number; path: string };
  currentFile: string | null;
  currentFileCount: number;
  totalFileCount: number;
  status: VideoFileScanTaskStatus;
  error: string | null;
  force: boolean;
}

export type VideoInferTaskSource = 'admin-infer-preview' | 'video-re-extract' | 'video-auto-extract';

export interface VideoInferTask {
  status: 'idle' | 'processing';
  waitingCount: number;
  current: {
    source: VideoInferTaskSource;
    target: string;
    startedAt: string;
  } | null;
  lastFinishedAt: string | null;
  lastError: string | null;
}

export type VideoFileIndexStrategyMode = 'blacklist';

export interface VideoFileIndexStrategy {
  id: number;
  mode: VideoFileIndexStrategyMode;
  fileDirId: number | null;
  fileKeyRegex: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  fileDir?: { path: string } | null;
}

export interface ApplyVideoFileIndexStrategyResult {
  strategyId: number;
  removed: number;
  fileIds: number[];
}

export interface CursorListResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface VideoFileFolderItem {
  fileDirId: number;
  path: string;
  name: string;
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
