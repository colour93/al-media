import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { HomeBanner } from '../components/HomeBanner/HomeBanner';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useHomeData } from '../hooks/useHomeData';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography variant="h6" fontWeight={600}>
        {title}
      </Typography>
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

  return (
    <Box>
      {bannerItems.length > 0 && (
        <>
          <SectionHeader title="轮播" />
          <HomeBanner items={bannerItems} />
        </>
      )}
      {recommendedItems.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader title="推荐" to="/videos" />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                md: 'repeat(auto-fill, minmax(180px, 1fr))',
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
      <Box sx={{ mb: 2 }}>
        <SectionHeader title="最新添加" to="/videos" />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(5, 1fr)',
              xl: 'repeat(6, 1fr)',
            },
            gap: 2,
          }}
        >
          {latestItems.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
