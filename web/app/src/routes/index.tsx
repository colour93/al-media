import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef } from 'react';
import { Box, Typography, CircularProgress, Button, Paper, Stack, useMediaQuery, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { Clapperboard, Clock3, Sparkles } from 'lucide-react';
import { HomeBanner } from '../components/HomeBanner/HomeBanner';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useBanner, useLatestInfinite, useRecommended } from '../hooks/useVideos';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function SectionHeader({ title, subtitle, to }: { title: string; subtitle?: string; to?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {to && (
        <Button component={Link} to={to} size="small" color="primary">
          查看更多
        </Button>
      )}
    </Box>
  );
}

function HomePage() {
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true });
  const upMd = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const upLg = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const upXl = useMediaQuery(theme.breakpoints.up('xl'), { noSsr: true });
  const masonryColumnCount = upXl ? 6 : upLg ? 5 : upMd ? 4 : upSm ? 3 : 2;

  const latestPageSize = 20;
  const { data: bannerData, isLoading: bannerLoading } = useBanner();
  const { data: recommendedData, isLoading: recommendedLoading } = useRecommended();
  const {
    data: latestPagesData,
    isLoading: latestLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useLatestInfinite(latestPageSize);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const latestItems = useMemo(() => {
    const pages = latestPagesData?.pages ?? [];
    const seen = new Set<number>();
    const merged: (typeof pages)[number]['items'] = [];
    for (const page of pages) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  }, [latestPagesData?.pages]);
  const masonryColumns = useMemo(() => {
    const columns = Array.from({ length: masonryColumnCount }, () => [] as (typeof latestItems)[number][]);
    latestItems.forEach((item, index) => {
      columns[index % masonryColumnCount]?.push(item);
    });
    return columns;
  }, [latestItems, masonryColumnCount]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        fetchNextPage();
      },
      { rootMargin: '720px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const isLoading =
    (bannerLoading || recommendedLoading || latestLoading) &&
    (bannerData == null || recommendedData == null || latestItems.length === 0);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const bannerItems = bannerData ?? [];
  const recommendedItems = recommendedData ?? [];
  const visibleVideoCount = new Set([...recommendedItems, ...latestItems].map((item) => item.id)).size;

  return (
    <Stack spacing={{ xs: 2.5, md: 3 }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(2,132,199,0.18) 0%, rgba(30,41,59,0.2) 55%, rgba(2,132,199,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(255,255,255,0.85) 58%, rgba(2,132,199,0.03) 100%)',
        }}
      >
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <Clapperboard size={17} />
          <Typography variant="subtitle1" fontWeight={700}>
            今日片单
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          已为你聚合推荐与最新资源，优先从热度高、更新快的内容开始浏览。
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 10, bgcolor: 'background.paper' }}>
            <Sparkles size={14} />
            <Typography variant="caption" fontWeight={600}>
              推荐 {recommendedItems.length}
            </Typography>
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 10, bgcolor: 'background.paper' }}>
            <Clock3 size={14} />
            <Typography variant="caption" fontWeight={600}>
              最新 {latestItems.length}
            </Typography>
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 10, bgcolor: 'background.paper' }}>
            <Typography variant="caption" fontWeight={600}>
              可见视频 {visibleVideoCount}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {bannerItems.length > 0 && (
        <Box>
          <SectionHeader title="焦点轮播" subtitle="快速查看近期重点内容" />
          <HomeBanner items={bannerItems} />
        </Box>
      )}
      {recommendedItems.length > 0 && (
        <Box>
          <SectionHeader title="为你推荐" subtitle="更偏向热度与匹配度" to="/resources" />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(148px, 1fr))',
                sm: 'repeat(auto-fill, minmax(168px, 1fr))',
                lg: 'repeat(auto-fill, minmax(190px, 1fr))',
              },
              gap: 2,
            }}
          >
            {recommendedItems.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </Box>
        </Box>
      )}
      <Box>
        <SectionHeader title="最新添加" />
        {latestItems.length > 0 ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${masonryColumnCount}, minmax(0, 1fr))`,
                gap: { xs: 1.5, md: 2 },
                alignItems: 'start',
              }}
            >
              {masonryColumns.map((column, columnIndex) => (
                <Box key={columnIndex} sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 }, minWidth: 0 }}>
                  {column.map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </Box>
              ))}
            </Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.5 }}
              ref={loadMoreRef}
            >
              {isFetchingNextPage ? (
                <CircularProgress size={24} />
              ) : hasNextPage ? (
                <Button onClick={() => fetchNextPage()} variant="outlined" size="small">
                  加载更多
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  已加载全部内容
                </Typography>
              )}
            </Box>
          </>
        ) : (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              暂无最新内容，稍后再来看看。
            </Typography>
          </Paper>
        )}
      </Box>
    </Stack>
  );
}
