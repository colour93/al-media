import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { Box, Paper, Typography, Button, CircularProgress, Pagination } from '@mui/material';
import { User, LogOut, ExternalLink } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fetchAuthMe, logout } from '../api/auth';
import { fetchCommonMetadata } from '../api/metadata';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useFavoriteVideos, useWatchHistory } from '../hooks/useVideos';

export const Route = createFileRoute('/me')({
  beforeLoad: async () => {
    const user = await fetchAuthMe();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  component: MePage,
});

const canAccessAdmin = (role: string) => role === 'owner' || role === 'admin';

function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MePage() {
  const pageSize = 12;
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ['authMe'],
    queryFn: fetchAuthMe,
  });
  const { data: metadata } = useQuery({
    queryKey: ['commonMetadata'],
    queryFn: fetchCommonMetadata,
    enabled: !!user && canAccessAdmin(user.role),
  });
  const { data: favoritesData, isLoading: favoritesLoading } = useFavoriteVideos(favoritesPage, pageSize, !!user);
  const { data: historyData, isLoading: historyLoading } = useWatchHistory(historyPage, pageSize, !!user);

  const handleLogout = async () => {
    await logout();
    queryClient.setQueryData(['authMe'], null);
    navigate({ to: '/login' });
  };

  if (!user) return null;

  const displayName = user.name || user.email || '用户';
  const showAdminLink = canAccessAdmin(user.role) && metadata?.adminPanelUrl;
  let adminSameOrigin = false;
  if (showAdminLink && metadata) {
    try {
      adminSameOrigin = new URL(metadata.adminPanelUrl).origin === window.location.origin;
    } catch (error) {
      void error;
    }
  }
  const favorites = favoritesData?.items ?? [];
  const historyItems = historyData?.items ?? [];
  const favoritePages = Math.max(1, Math.ceil((favoritesData?.total ?? 0) / pageSize));
  const historyPages = Math.max(1, Math.ceil((historyData?.total ?? 0) / pageSize));

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        我的
      </Typography>
      <Paper sx={{ p: 3, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <User size={48} style={{ opacity: 0.5 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {displayName}
              </Typography>
              {user.email && (
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {showAdminLink && (
              <Button
                variant="outlined"
                startIcon={<ExternalLink size={18} />}
                href={metadata!.adminPanelUrl}
                {...(adminSameOrigin ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              >
                管理面板
              </Button>
            )}
            <Button variant="outlined" color="error" startIcon={<LogOut size={18} />} onClick={handleLogout}>
              退出登录
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          收藏夹
        </Typography>
        {favoritesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={26} />
          </Box>
        ) : favorites.length === 0 ? (
          <Typography color="text.secondary">还没有收藏视频</Typography>
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)',
                },
                gap: 2,
              }}
            >
              {favorites.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </Box>
            {favoritePages > 1 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination count={favoritePages} page={favoritesPage} onChange={(_, page) => setFavoritesPage(page)} />
              </Box>
            ) : null}
          </>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          播放历史
        </Typography>
        {historyLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={26} />
          </Box>
        ) : historyItems.length === 0 ? (
          <Typography color="text.secondary">暂无播放历史</Typography>
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)',
                },
                gap: 2,
              }}
            >
              {historyItems.map((item) => (
                <Box key={item.video.id}>
                  <VideoCard video={item.video} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {item.completed
                      ? '已看完'
                      : `看到 ${formatDuration(item.progressSeconds)} / ${formatDuration(item.durationSeconds)}`}
                  </Typography>
                </Box>
              ))}
            </Box>
            {historyPages > 1 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination count={historyPages} page={historyPage} onChange={(_, page) => setHistoryPage(page)} />
              </Box>
            ) : null}
          </>
        )}
      </Paper>
    </Box>
  );
}
