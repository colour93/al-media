import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, CircularProgress } from '@mui/material';
import { HomeBanner } from '../components/HomeBanner/HomeBanner';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useHomeData } from '../hooks/useHomeData';

export const Route = createFileRoute('/')({
  component: HomePage,
});

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
          <Typography variant="h6" fontWeight={600} gutterBottom>
            轮播
          </Typography>
          <HomeBanner items={bannerItems} />
        </>
      )}
      {recommendedItems.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            推荐
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                md: 'repeat(auto-fill, minmax(180px, 1fr))',
              },
              gap: 2,
              overflowX: { xs: 'auto', md: 'visible' },
              pb: 1,
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'action.selected' },
            }}
          >
            {recommendedItems.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </Box>
        </Box>
      )}
      <Typography variant="h6" fontWeight={600} gutterBottom>
        最新添加
      </Typography>
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
  );
}
