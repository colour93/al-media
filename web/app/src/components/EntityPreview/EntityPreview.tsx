import type React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { getFileUrl } from '../../api/file';
import { renderLucideIcon } from '../../utils/lucideIcons';
import type { Actor, Creator, Tag } from '../../api/types';

export type EntityType = 'actor' | 'creator' | 'tag';

const ENTITY_ROUTES: Record<EntityType, (id: number) => string> = {
  actor: (id) => `/actors/${id}`,
  creator: (id) => `/creators/${id}`,
  tag: (id) => `/tags/${id}`,
};

export interface EntityPreviewProps {
  entityType: EntityType;
  entity: Actor | Creator | Tag;
  size?: 'sm' | 'md';
  /** actor 专用：'card' 为头像上、名字下的布局。双行名字仅在此模式下启用 */
  layout?: 'inline' | 'card';
  /** 在外层已是链接时禁用内部跳转，避免出现 <a> 嵌套 */
  disableLink?: boolean;
}

export function EntityPreview({
  entityType,
  entity,
  size = 'sm',
  layout = 'inline',
  disableLink = false,
}: EntityPreviewProps) {
  const to = ENTITY_ROUTES[entityType](entity.id);
  const isCard = layout === 'card' && entityType === 'actor';
  const linkSx = isCard
    ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 1,
        px: 0.5,
        py: 0.5,
        minWidth: 48,
        '&:hover': { bgcolor: 'action.hover' },
      }
    : {
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
        const avatarSize = isCard ? 40 : size === 'sm' ? 24 : 32;
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
                  borderRadius: isCard ? '50%' : 1,
                  objectFit: 'cover',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: isCard ? '50%' : 1,
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
            <Typography
              variant="body2"
              sx={
                isCard
                  ? {
                      maxWidth: 64,
                      overflow: 'hidden',
                      textAlign: 'center',
                    }
                  : { maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
              }
              title={a.name}
            >
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
        const tagWithType = entity as Tag & { tagType?: { name?: string; icon?: string | null } };
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
      default:
        return null;
    }
  })();

  if (disableLink) {
    return (
      <Box component="span" sx={linkSx}>
        {content}
      </Box>
    );
  }

  return (
    <Box component={Link} to={to} preload="intent" sx={linkSx}>
      {content}
    </Box>
  );
}
