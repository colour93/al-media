import { Card, CardActionArea, CardMedia, CardContent, Typography, Box } from '@mui/material';
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

  return (
    <Card
      component={Link}
      to="/videos/$id"
      params={{ id: String(video.id) }}
      preload="intent"
      sx={{
        width: '100%',
        aspectRatio: { xs: '1/0.94', sm: '1/0.9' },
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <CardActionArea sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box
          sx={{
            position: 'relative',
            aspectRatio: { xs: '16/8.8', sm: '16/9' },
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <CardMedia
            component="img"
            image={thumbUrl || undefined}
            alt={video.title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              bgcolor: 'action.hover',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              px: 0.5,
              borderRadius: 0.5,
            }}
          >
            <Eye size={11} />
            <Typography variant="caption" color="inherit">
              {playCount}
            </Typography>
          </Box>
          {(duration || fileSize) && (
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                px: 0.5,
                borderRadius: 0.5,
              }}
            >
              {[duration, fileSize].filter(Boolean).join(' · ')}
            </Typography>
          )}
        </Box>
        <CardContent sx={{ py: 1, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Typography variant="body2" fontWeight={500} noWrap title={video.title}>
            {video.title}
          </Typography>
          {showActors && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: { xs: 0.25, sm: 0.5 },
                rowGap: { xs: 0.125, sm: 0.25 },
                mt: { xs: 0.375, sm: 0.5 },
              }}
            >
              {video.actors?.map((a) => (
                <EntityPreview key={a.id} entityType="actor" entity={a} size="sm" compact disableLink />
              ))}
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
