import { Box, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { getThumbnailUrl } from '../../api/file';
import { EntityPreview } from '../EntityPreview/EntityPreview';
import type { VideoDetail } from '../../api/types';

function formatDuration(seconds?: number): string {
  if (seconds == null || seconds < 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface VideoSidebarCardProps {
  video: VideoDetail;
}

export function VideoSidebarCard({ video }: VideoSidebarCardProps) {
  const thumbUrl = getThumbnailUrl(video.thumbnailKey);
  const duration = formatDuration(video.videoDuration);
  const fileSize = formatFileSize(video.fileSize);
  const metaParts = [duration, fileSize].filter(Boolean).join(' · ');

  return (
    <Box
      component={Link}
      to="/videos/$id"
      params={{ id: String(video.id) }}
      preload="intent"
      sx={{
        display: 'flex',
        gap: 1.5,
        textDecoration: 'none',
        color: 'inherit',
        '&:hover': { bgcolor: 'action.hover' },
        borderRadius: 1,
        p: 0.5,
        height: 90,
        minHeight: 90,
        boxSizing: 'border-box',
      }}
    >
      <Box
        component="img"
        src={thumbUrl || undefined}
        alt={video.title}
        sx={{
          width: 120,
          minWidth: 120,
          height: 68,
          objectFit: 'cover',
          borderRadius: 1,
          bgcolor: 'action.hover',
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.3 }} noWrap title={video.title}>
          {video.title}
        </Typography>
        {metaParts && (
          <Typography variant="caption" color="text.secondary" display="block">
            {metaParts}
          </Typography>
        )}
        <Box sx={{ mt: 0.25, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {video.actors?.map((a) => (
            <EntityPreview key={a.id} entityType="actor" entity={a} size="sm" disableLink />
          ))}
          {video.creators?.map((c) => (
            <EntityPreview key={c.id} entityType="creator" entity={c} size="sm" disableLink />
          ))}
          {video.tags?.map((t) => (
            <EntityPreview key={t.id} entityType="tag" entity={t} size="sm" disableLink />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
