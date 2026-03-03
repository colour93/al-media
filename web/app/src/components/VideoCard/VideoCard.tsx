import { Card, CardContent, Typography, Box } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { Eye } from 'lucide-react';
import { getThumbnailUrl } from '../../api/file';
import { EntityPreview } from '../EntityPreview/EntityPreview';
import type { VideoDetail } from '../../api/types';
import { formatDurationFromSeconds, formatShortPlayCount } from '../../utils/format';

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface VideoCardProps {
  video: VideoDetail;
  showActors?: boolean;
}

export function VideoCard({ video, showActors = true }: VideoCardProps) {
  const thumbUrl = getThumbnailUrl(video.thumbnailKey);
  const duration = formatDurationFromSeconds(video.videoDuration);
  const fileSize = formatFileSize(video.fileSize);
  const playCount = formatShortPlayCount(video.playCount);
  const actors = video.actors ?? [];
  const visibleActors = actors.slice(0, 2);
  const hiddenActorCount = Math.max(0, actors.length - visibleActors.length);

  return (
    <Card
      component={Link}
      to="/videos/$id"
      params={{ id: String(video.id) }}
      preload="intent"
      sx={{
        width: '100%',
        height: '100%',
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            // transform: 'translateY(-3px)',
            boxShadow: 6,
            borderColor: 'primary.main',
          },
          // '&:hover .video-card-thumb': {
          //   transform: 'scale(1.04)',
          // },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/9',
          flexShrink: 0,
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        <Box
          component="img"
          className="video-card-thumb"
          src={thumbUrl || undefined}
          alt={video.title}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.28s ease',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 40,
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)',
          }}
        />
        {(duration || fileSize) && (
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              bgcolor: 'rgba(0,0,0,0.72)',
              color: 'white',
              px: 0.75,
              py: 0.2,
              borderRadius: 1,
              lineHeight: 1.2,
            }}
          >
            {[duration, fileSize].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>
      <CardContent
        sx={{
          py: 1.1,
          px: 1.1,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          title={video.title}
          sx={{
            lineHeight: 1.35,
            minHeight: '2.7em',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {video.title}
        </Typography>
        <Box sx={{ mt: 0.6, display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
          <Eye size={12} />
          <Typography variant="caption" color="inherit">
            {playCount}
          </Typography>
        </Box>
        {showActors && visibleActors.length > 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 0.35,
              rowGap: 0.2,
              mt: 0.6,
            }}
          >
            {visibleActors.map((a) => (
              <EntityPreview key={a.id} entityType="actor" entity={a} size="sm" compact disableLink />
            ))}
            {hiddenActorCount > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 0.25 }}>
                +{hiddenActorCount}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
