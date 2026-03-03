export interface PaginatedResult<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface Actor {
  id: number;
  name: string;
  avatarKey?: string | null;
}

export interface Creator {
  id: number;
  name: string;
  type?: 'person' | 'group';
  platform?: string | null;
  platformId?: string | null;
}

export interface TagType {
  id?: number;
  name?: string;
  icon?: string | null;
}

export interface Tag {
  id: number;
  name: string;
  color?: string | null;
  tagType?: TagType;
}

export interface Distributor {
  id: number;
  name: string;
}

export interface Video {
  id: number;
  title: string;
  thumbnailKey: string | null;
  webCompatible?: boolean;
  webCompatibilityIssues?: string[];
  webCompatibilityHint?: string | null;
  videoFileVideoCodec?: string | null;
  videoFileAudioCodec?: string | null;
  videoFileMp4MoovBeforeMdat?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoDetail extends Video {
  actors?: Actor[];
  creators?: Creator[];
  distributors?: Distributor[];
  tags?: Tag[];
  videoFileUrl?: string | null;
  videoFileKey?: string | null;
  /** 视频时长（秒） */
  videoDuration?: number;
  /** 文件大小（字节） */
  fileSize?: number;
  /** 播放量（同一用户可重复累计） */
  playCount?: number;
}

export interface VideoHistoryState {
  progressSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  lastPlayedAt: string;
}

export interface VideoInteractionState {
  isFavorite: boolean;
  history: VideoHistoryState | null;
}

export interface VideoHistoryItem extends VideoHistoryState {
  video: VideoDetail;
}

export type ResourceCategory = 'all' | 'video' | 'actor' | 'creator' | 'distributor' | 'tag';

export type SearchActor = Actor & { tags?: Tag[] };
export type SearchCreator = Creator & { actor?: Actor | null; tags?: Tag[] };
export type SearchTag = Tag & { tagType?: TagType };

export interface ResourceSearchResult {
  q: string;
  category: ResourceCategory;
  filters: {
    includeTagIds: number[];
    excludeTagIds: number[];
  };
  videos: PaginatedResult<VideoDetail>;
  actors: PaginatedResult<SearchActor>;
  creators: PaginatedResult<SearchCreator>;
  distributors: PaginatedResult<Distributor>;
  tags: PaginatedResult<SearchTag>;
}
