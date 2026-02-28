import { Box, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { getThumbnailUrl } from '../../api/file';
import type { VideoDetail } from '../../api/types';
import { useState, useEffect, useRef, useCallback } from 'react';

interface HomeBannerProps {
  items: VideoDetail[];
}

export function HomeBanner({ items }: HomeBannerProps) {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    const children = scrollRef.current?.children;
    if (children) {
      (children[idx] as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % items.length;
        const children = scrollRef.current?.children;
        if (children) {
          (children[next] as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <Box sx={{ position: 'relative', width: '100%', mb: 3, borderRadius: 2, overflow: 'hidden' }}>
      <Box
        ref={scrollRef}
        sx={{
          display: 'flex',
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
                position: 'relative',
              }}
            >
              <Box
                component="img"
                src={thumbUrl || undefined}
                alt={video.title}
                sx={{
                  width: '100%',
                  aspectRatio: '16/9',
                  maxHeight: 340,
                  objectFit: 'cover',
                  display: 'block',
                  bgcolor: 'action.hover',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
                  px: 2,
                  pt: 5,
                  pb: items.length > 1 ? 4 : 2,
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  noWrap
                  sx={{ color: 'white', lineHeight: 1.3 }}
                >
                  {video.title}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {items.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 0.75,
            zIndex: 1,
          }}
        >
          {items.map((_, idx) => (
            <Box
              key={idx}
              onClick={() => goTo(idx)}
              sx={{
                width: idx === current ? 20 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor: idx === current ? 'white' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
