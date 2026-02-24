import { useQuery } from '@tanstack/react-query';
import {
  fetchActor,
  fetchActorCreators,
  fetchActorVideos,
  fetchCreator,
  fetchCreatorVideos,
  fetchTag,
  fetchTagRelated,
} from '../api/entities';
import type { TagRelatedCategory } from '../api/entities';

export function useActor(id: number | null) {
  return useQuery({
    queryKey: ['admin', 'actor', id],
    queryFn: () => fetchActor(id!),
    enabled: id != null,
  });
}

export function useActorVideos(actorId: number | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['admin', 'actor', actorId, 'videos', page, pageSize],
    queryFn: () => fetchActorVideos(actorId!, page, pageSize),
    enabled: actorId != null,
  });
}

export function useActorCreators(actorId: number | null) {
  return useQuery({
    queryKey: ['admin', 'actor', actorId, 'creators'],
    queryFn: () => fetchActorCreators(actorId!),
    enabled: actorId != null,
  });
}

export function useCreator(id: number | null) {
  return useQuery({
    queryKey: ['admin', 'creator', id],
    queryFn: () => fetchCreator(id!),
    enabled: id != null,
  });
}

export function useCreatorVideos(creatorId: number | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['admin', 'creator', creatorId, 'videos', page, pageSize],
    queryFn: () => fetchCreatorVideos(creatorId!, page, pageSize),
    enabled: creatorId != null,
  });
}

export function useTag(id: number | null) {
  return useQuery({
    queryKey: ['admin', 'tag', id],
    queryFn: () => fetchTag(id!),
    enabled: id != null,
  });
}

export function useTagRelated(
  tagId: number | null,
  category: TagRelatedCategory,
  page: number,
  pageSize: number
) {
  return useQuery({
    queryKey: ['admin', 'tag', tagId, 'related', category, page, pageSize],
    queryFn: () => fetchTagRelated(tagId!, category, page, pageSize),
    enabled: tagId != null,
  });
}
