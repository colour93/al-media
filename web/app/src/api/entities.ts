import { get } from './client';
import type { PaginatedResult } from './types';
import type { Actor, Creator, Tag, VideoDetail } from './types';

const ACTOR_BASE = '/actors';
const CREATOR_BASE = '/creators';
const TAG_BASE = '/tags';

export type ActorDetail = Actor & { tags?: Tag[] };
export type CreatorDetail = Creator & { tags?: Tag[]; actor?: Actor | null };

export async function fetchActor(id: number): Promise<ActorDetail> {
  return get<ActorDetail>(`${ACTOR_BASE}/${id}`, undefined, 'admin');
}

export async function fetchActorVideos(id: number, page: number, pageSize: number): Promise<PaginatedResult<VideoDetail>> {
  return get<PaginatedResult<VideoDetail>>(`${ACTOR_BASE}/${id}/videos`, { page, pageSize }, 'admin');
}

export async function fetchActorCreators(actorId: number): Promise<Creator[]> {
  return get<Creator[]>(`${ACTOR_BASE}/${actorId}/creators`, undefined, 'admin');
}

export async function fetchCreator(id: number): Promise<CreatorDetail> {
  return get<CreatorDetail>(`${CREATOR_BASE}/${id}`, undefined, 'admin');
}

export async function fetchCreatorVideos(id: number, page: number, pageSize: number): Promise<PaginatedResult<VideoDetail>> {
  return get<PaginatedResult<VideoDetail>>(`${CREATOR_BASE}/${id}/videos`, { page, pageSize }, 'admin');
}

export async function fetchTag(id: number): Promise<Tag & { tagType?: { id: number; name: string } }> {
  return get<Tag & { tagType?: { id: number; name: string } }>(`${TAG_BASE}/${id}`, undefined, 'admin');
}

export type TagRelatedCategory = 'actor' | 'creator' | 'video';

export async function fetchTagRelated(
  id: number,
  category: TagRelatedCategory,
  page: number,
  pageSize: number
): Promise<PaginatedResult<Actor | Creator | VideoDetail>> {
  return get<PaginatedResult<Actor | Creator | VideoDetail>>(`${TAG_BASE}/${id}/related`, {
    category,
    page,
    pageSize,
  }, 'admin');
}
