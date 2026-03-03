import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, CircularProgress, Button, Paper, Stack } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { Clapperboard, Clock3, Sparkles } from 'lucide-react';
import { HomeBanner } from '../components/HomeBanner/HomeBanner';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useHomeData } from '../hooks/useHomeData';

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
  const { banner, recommended, latest, isLoading } = useHomeData(1, 12);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const bannerItems = banner.data ?? [];
  const recommendedItems = recommended.data ?? [];
  const latestItems = latest.data?.items ?? [];
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
        <SectionHeader title="最新添加" subtitle="按入库时间排序" to="/resources" />
        {latestItems.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
                lg: 'repeat(5, minmax(0, 1fr))',
                xl: 'repeat(6, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            {latestItems.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </Box>
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
