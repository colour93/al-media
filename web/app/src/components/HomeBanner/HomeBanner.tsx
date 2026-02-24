import { Box } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { getThumbnailUrl } from '../../api/file';
import type { VideoDetail } from '../../api/types';

interface HomeBannerProps {
  items: VideoDetail[];
}

export function HomeBanner({ items }: HomeBannerProps) {
  if (items.length === 0) return null;

  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '16/9',
        maxHeight: 320,
        borderRadius: 2,
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {items.map((video) => {
          const thumbUrl = getThumbnailUrl(video.thumbnailKey);
          return (
            <Box
              key={video.id}
              component={Link}
              to="/videos/$id"
              params={{ id: String(video.id) }}
              sx={{
                flex: '0 0 100%',
                scrollSnapAlign: 'start',
                display: 'block',
                textDecoration: 'none',
              }}
            >
              <Box
                component="img"
                src={thumbUrl || undefined}
                alt={video.title}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  aspectRatio: '16/9',
                  maxHeight: 320,
                  bgcolor: 'action.hover',
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
