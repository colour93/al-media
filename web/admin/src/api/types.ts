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
  fileDirId: number | null;
  folderPath: string | null;
  filenameRegex: string | null;
  tagIds: number[];
  creatorIds: number[];
  actorIds: number[];
  distributorIds: number[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  fileDir?: FileDir;
}

export interface BindingFolderBindingItem {
  fileDirId: number;
  folderPath: string;
  strategyIds: number[];
  primaryStrategyId: number | null;
  strategyCount: number;
  enabled: boolean;
  tagIds: number[];
  creatorIds: number[];
  actorIds: number[];
  distributorIds: number[];
}

export interface BindingFolderBindingSnapshot {
  fileDirId: number;
  items: BindingFolderBindingItem[];
  tags: Array<Tag & { tagType: TagType | null }>;
  creators: Creator[];
  actors: Actor[];
  distributors: Distributor[];
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
  tags?: Tag[];
}

export interface VideoFile {
  id: number;
  fileDirId: number;
  sourceVideoFileId?: number | null;
  fileKey: string;
  uniqueId: string;
  fileSize: number;
  fileModifiedAt: string;
  videoDuration: number;
  videoCodec?: string | null;
  audioCodec?: string | null;
  mp4MoovAtomOffset?: number | null;
  mp4MdatAtomOffset?: number | null;
  mp4MoovBeforeMdat?: boolean | null;
  webCompatible?: boolean;
  webCompatibilityIssues?: string[];
  webCompatibilityHint?: string | null;
  createdAt: string;
  updatedAt: string;
  video?: Video | null;
  fileDir?: { id: number; path: string } | null;
  sourceVideoFile?: { id: number; fileKey: string } | null;
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
  status: 'idle' | 'processing' | 'paused';
  waitingCount: number;
  current: {
    source: VideoInferTaskSource;
    target: string;
    startedAt: string;
  } | null;
  lastFinishedAt: string | null;
  lastError: string | null;
}

export interface VideoReencodeTask {
  status: 'idle' | 'processing';
  waitingCount: number;
  current: {
    videoFileId: number;
    sourceFileKey: string;
    outputFileKey: string | null;
    startedAt: string;
  } | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  lastOutputVideoFileId: number | null;
  lastOutputFileKey: string | null;
  lastSourceVideoFileId: number | null;
  lastSourceFileKey: string | null;
}

export interface EnqueueAllVideoReencodeResult {
  candidateCount: number;
  enqueuedCount: number;
  skippedCount: number;
  deleteSourceAfterSuccess: boolean;
  task: VideoReencodeTask;
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

export interface VideoFileFolderPrefixesResult {
  items: string[];
  total: number;
  truncated: boolean;
}

export interface VideoFileDuplicateGroup {
  uniqueId: string;
  fileCount: number;
  files: VideoFile[];
}

export interface Video {
  id: number;
  title: string;
  thumbnailKey: string | null;
  preferredVideoFileId?: number | null;
  isFeatured?: boolean;
  isBanner?: boolean;
  bannerOrder?: number | null;
  recommendedOrder?: number | null;
  webCompatible?: boolean;
  webCompatibilityIssues?: string[];
  webCompatibilityHint?: string | null;
  videoFileVideoCodec?: string | null;
  videoFileAudioCodec?: string | null;
  videoFileMp4MoovBeforeMdat?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export type DashboardTimeUnit = 'day' | 'week' | 'month';

export interface DashboardTrendPoint {
  bucketKey: string;
  bucketStart: string;
  label: string;
  videos: number;
  videoFiles: number;
  playCount: number;
  users: number;
}

export interface DashboardStats {
  unit: DashboardTimeUnit;
  span: number;
  from: string;
  to: string;
  points: DashboardTrendPoint[];
  totals: {
    videos: number;
    videoFiles: number;
    playCount: number;
    users: number;
  };
  scanTask: VideoFileScanTask | null;
  inferTask: VideoInferTask;
  reencodeTask: VideoReencodeTask;
}
