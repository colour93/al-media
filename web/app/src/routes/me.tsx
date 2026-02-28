import { createFileRoute, redirect } from '@tanstack/react-router';
import { type MouseEvent, type ReactNode, useState } from 'react';
import { Box, Paper, Typography, Button, CircularProgress, Pagination, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { User, LogOut, ExternalLink } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fetchAuthMe, logout } from '../api/auth';
import { fetchCommonMetadata } from '../api/metadata';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useFavoriteVideos, useWatchHistory } from '../hooks/useVideos';
import { formatDurationFromSeconds } from '../utils/format';
import { type ThemePreference, useThemeMode } from '../contexts/ThemeModeContext';

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

interface VideoCollectionSectionProps {
  title: string;
  total: number;
  loading: boolean;
  emptyText: string;
  totalPages: number;
  page: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}

function VideoCollectionSection({
  title,
  total,
  loading,
  emptyText,
  totalPages,
  page,
  onPageChange,
  children,
}: VideoCollectionSectionProps) {
  return (
    <Paper
      sx={{
        p: { xs: 2, md: 3 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          共 {total} 条
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5, flex: 1 }}>
          <CircularProgress size={26} />
        </Box>
      ) : total === 0 ? (
        <Box sx={{ py: 4, flex: 1 }}>
          <Typography color="text.secondary">{emptyText}</Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                sm: 'repeat(auto-fill, minmax(170px, 1fr))',
              },
              gap: { xs: 1.5, md: 2 },
            }}
          >
            {children}
          </Box>
          {totalPages > 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
              <Pagination count={totalPages} page={page} onChange={(_, nextPage) => onPageChange(nextPage)} />
            </Box>
          ) : null}
        </>
      )}
    </Paper>
  );
}

function MePage() {
  const pageSize = 12;
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const { preference, setPreference } = useThemeMode();
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
  const favoritesTotal = favoritesData?.total ?? 0;
  const historyTotal = historyData?.total ?? 0;
  const favoritePages = Math.max(1, Math.ceil(favoritesTotal / pageSize));
  const historyPages = Math.max(1, Math.ceil(historyTotal / pageSize));
  const handleThemeChange = (_: MouseEvent<HTMLElement>, next: ThemePreference | null) => {
    if (!next) return;
    setPreference(next);
  };

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
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            主题模式
          </Typography>
          <ToggleButtonGroup size="small" exclusive value={preference} onChange={handleThemeChange}>
            <ToggleButton value="system">系统</ToggleButton>
            <ToggleButton value="light">浅色</ToggleButton>
            <ToggleButton value="dark">深色</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: { xs: 2, md: 2.5 },
          alignItems: 'start',
        }}
      >
        <VideoCollectionSection
          title="收藏夹"
          total={favoritesTotal}
          loading={favoritesLoading}
          emptyText="还没有收藏视频"
          totalPages={favoritePages}
          page={favoritesPage}
          onPageChange={setFavoritesPage}
        >
          {favorites.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </VideoCollectionSection>

        <VideoCollectionSection
          title="播放历史"
          total={historyTotal}
          loading={historyLoading}
          emptyText="暂无播放历史"
          totalPages={historyPages}
          page={historyPage}
          onPageChange={setHistoryPage}
        >
          {historyItems.map((item) => (
            <Box key={item.video.id}>
              <VideoCard video={item.video} showActors={false} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, px: 0.25, display: 'block', lineHeight: 1.4 }}>
                {`看到 ${formatDurationFromSeconds(item.progressSeconds, '--:--')} / ${formatDurationFromSeconds(item.durationSeconds, '--:--')}${item.completed ? '（已看完）' : ''}`}
              </Typography>
            </Box>
          ))}
        </VideoCollectionSection>
      </Box>
    </Box>
  );
}
