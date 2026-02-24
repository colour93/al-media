import { Card, CardActionArea, CardMedia, CardContent, Typography, Box } from '@mui/material';
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

interface VideoCardProps {
  video: VideoDetail;
}

export function VideoCard({ video }: VideoCardProps) {
  const thumbUrl = getThumbnailUrl(video.thumbnailKey);
  const duration = formatDuration(video.videoDuration);
  const fileSize = formatFileSize(video.fileSize);

  return (
    <Card
      component={Link}
      to="/videos/$id"
      params={{ id: String(video.id) }}
      preload="intent"
      sx={{
        height: '100%',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      }}
    >
      <CardActionArea sx={{ height: '100%' }}>
        <Box sx={{ position: 'relative' }}>
          <CardMedia
            component="img"
            height={140}
            image={thumbUrl || undefined}
            alt={video.title}
            sx={{
              objectFit: 'cover',
              bgcolor: 'action.hover',
            }}
          />
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
        <CardContent sx={{ py: 1.5 }}>
          <Typography variant="body2" fontWeight={500} noWrap title={video.title}>
            {video.title}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {video.actors?.map((a) => (
              <EntityPreview key={a.id} entityType="actor" entity={a} size="sm" />
            ))}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
