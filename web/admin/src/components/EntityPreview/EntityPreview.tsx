import type React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Link, useRouter } from '@tanstack/react-router';
import { getFileUrl } from '../../api/file';
import { renderLucideIcon } from '../../utils/lucideIcons';
import { useEntityRelated } from '../../contexts/EntityRelatedContext';
import type {
  Actor,
  Creator,
  Distributor,
  Tag,
  TagType,
  Video,
  VideoFile,
} from '../../api/types';

export type EntityType =
  | 'actor'
  | 'creator'
  | 'tag'
  | 'tagType'
  | 'distributor'
  | 'video'
  | 'videoFile';

const ROUTES: Record<EntityType, string> = {
  actor: '/actors',
  creator: '/creators',
  tag: '/tags',
  tagType: '/tag-types',
  distributor: '/distributors',
  video: '/videos',
  videoFile: '/video-files',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface EntityPreviewProps {
  entityType: EntityType;
  entity: Actor | Creator | Distributor | Tag | TagType | Video | VideoFile;
  size?: 'sm' | 'md';
  /** 内联模式，不渲染链接，适用于 Autocomplete 等场景 */
  inline?: boolean;
}

const DRAWER_ENTITY_TYPES: EntityType[] = ['actor', 'creator', 'tag'];

export function EntityPreview({ entityType, entity, size = 'sm', inline = false }: EntityPreviewProps) {
  const router = useRouter({ warn: false });
  const entityRelated = useEntityRelated();
  const hasRouter = !!router;
  const isVideoFile = entityType === 'videoFile';
  const useDrawer = DRAWER_ENTITY_TYPES.includes(entityType) && entityRelated;
  const linkSx = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    textDecoration: 'none',
    color: 'inherit',
    borderRadius: 1,
    px: size === 'sm' ? 0.5 : 1,
    py: 0.25,
    '&:hover': { bgcolor: 'action.hover' },
  };

  const content = (() => {
    switch (entityType) {
      case 'actor': {
        const a = entity as Actor;
        const avatarSize = size === 'sm' ? 24 : 32;
        return (
          <>
            {a.avatarKey ? (
              <Box
                component="img"
                src={getFileUrl('avatars', a.avatarKey)}
                alt=""
                sx={{
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: 1,
                  objectFit: 'cover',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  ?
                </Typography>
              </Box>
            )}
            <Typography variant="body2" noWrap sx={{ maxWidth: 100 }}>
              {a.name}
            </Typography>
          </>
        );
      }
      case 'creator': {
        const c = entity as Creator;
        return (
          <>
            <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
              {c.name}
            </Typography>
            {c.platform && (
              <Chip size="small" label={c.platform} sx={{ height: 18, fontSize: '0.7rem' }} />
            )}
          </>
        );
      }
      case 'tag': {
        const t = entity as Tag;
        const tagWithType = entity as Tag & { tagType?: TagType };
        const iconEl = tagWithType.tagType?.icon
          ? renderLucideIcon(tagWithType.tagType.icon, { size: 12 })
          : null;
        const tagTypeName = tagWithType.tagType?.name ?? '';
        const label = tagTypeName ? `${tagTypeName}: ${t.name}` : t.name;
        return (
          <Chip
            size="small"
            icon={iconEl ? (iconEl as React.ReactElement) : undefined}
            label={label}
            sx={{
              bgcolor: t.color ?? 'action.selected',
              '& .MuiChip-label': { color: t.color ? 'rgba(0,0,0,0.7)' : 'inherit' },
              maxWidth: 200,
            }}
          />
        );
      }
      case 'tagType': {
        const tt = entity as TagType;
        const iconEl = renderLucideIcon(tt.icon ?? null, {
          size: size === 'sm' ? 16 : 20,
        });
        return (
          <>
            {iconEl}
            <Typography variant="body2" noWrap sx={{ maxWidth: 100 }}>
              {tt.name}
            </Typography>
          </>
        );
      }
      case 'distributor': {
        const d = entity as Distributor;
        return (
          <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
            {d.name}
          </Typography>
        );
      }
      case 'video': {
        const v = entity as Video;
        const thumbSize = size === 'sm' ? 36 : 48;
        return (
          <>
            {v.thumbnailKey ? (
              <Box
                component="img"
                src={getFileUrl('thumbnails', v.thumbnailKey)}
                alt=""
                sx={{
                  width: thumbSize,
                  height: thumbSize * 0.75,
                  borderRadius: 0.5,
                  objectFit: 'cover',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: thumbSize,
                  height: thumbSize * 0.75,
                  borderRadius: 0.5,
                  bgcolor: 'action.selected',
                }}
              />
            )}
            <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
              {v.title}
            </Typography>
          </>
        );
      }
      case 'videoFile': {
        const vf = entity as VideoFile;
        return (
          <>
            <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
              {vf.fileKey}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDuration(vf.videoDuration)}
            </Typography>
          </>
        );
      }
      default:
        return null;
    }
  })();

  if (inline || !hasRouter) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {content}
      </Box>
    );
  }

  if (isVideoFile) {
    return (
      <Box component="span" sx={linkSx}>
        {content}
      </Box>
    );
  }

  if (useDrawer) {
    return (
      <Box
        component="span"
        role="button"
        tabIndex={0}
        onClick={() =>
          entityRelated?.openRelatedDrawer(entityType as 'actor' | 'creator' | 'tag', entity as Actor | Creator | Tag)
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            entityRelated?.openRelatedDrawer(entityType as 'actor' | 'creator' | 'tag', entity as Actor | Creator | Tag);
          }
        }}
        sx={{ ...linkSx, cursor: 'pointer' }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box
      component={Link}
      to={ROUTES[entityType]}
      search={(prev: Record<string, unknown>) => ({ ...prev, editId: entity.id })}
      sx={linkSx}
    >
      {content}
    </Box>
  );
}
