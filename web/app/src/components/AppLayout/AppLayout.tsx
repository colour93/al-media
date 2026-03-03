import { useState } from 'react';
import {
  Box,
  Container,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Typography,
  Avatar,
  Tooltip,
  useTheme,
  useMediaQuery,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Home, FolderSearch, Search, User, Download } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAuthConfig, fetchAuthMe } from '../../api/auth';
import { ThemeModeButton } from '../ThemeModeButton/ThemeModeButton';
import { usePwaInstall } from '../../contexts/PwaInstallContext';
import { DEFAULT_SITE_CONFIG } from '../../config/site';

const isSecondLevelPage = (pathname: string) => pathname.split('/').filter(Boolean).length >= 2;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const onSecondLevelPage = isSecondLevelPage(pathname);
  const showMobileBottomNav = !isDesktop && !onSecondLevelPage;
  const { shouldAutoPrompt, dismissAutoPrompt, requestInstall } = usePwaInstall();
  const [installingPwa, setInstallingPwa] = useState(false);
  const [globalSearchInput, setGlobalSearchInput] = useState('');

  const { data: user } = useQuery({
    queryKey: ['authMe'],
    queryFn: fetchAuthMe,
    staleTime: 5 * 60 * 1000,
  });
  const { data: authConfig } = useQuery({
    queryKey: ['authConfig'],
    queryFn: fetchAuthConfig,
    staleTime: 10 * 60 * 1000,
  });

  const navValue =
    pathname === '/'
      ? '/'
      : pathname.startsWith('/resources') || pathname.startsWith('/videos')
        ? '/resources'
        : pathname === '/me'
          ? '/me'
          : pathname;

  const userInitial = (user?.name || user?.email || '?')[0].toUpperCase();
  const siteName = authConfig?.site.name || DEFAULT_SITE_CONFIG.name;
  const siteLogo = authConfig?.site.favicon || DEFAULT_SITE_CONFIG.favicon;

  const handleInstallPwa = async () => {
    setInstallingPwa(true);
    try {
      const result = await requestInstall();
      if (result !== 'accepted') {
        dismissAutoPrompt();
      }
    } finally {
      setInstallingPwa(false);
    }
  };

  const handleGlobalSearch = () => {
    navigate({
      to: '/resources',
      search: {
        q: globalSearchInput || '',
        category: 'all',
        page: 1,
        pageSize: 12,
      },
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: showMobileBottomNav ? 7 : 0 }}>
      {onSecondLevelPage ? (
        <AppBar position="sticky" color="default" elevation={1}>
          <Container maxWidth="xl">
            <Toolbar disableGutters>
              <Box
                component={Link}
                to="/"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  textDecoration: 'none',
                  color: 'inherit',
                  minWidth: 0,
                }}
              >
                <Box
                  component="img"
                  src={siteLogo}
                  alt={siteName}
                  sx={{ width: 28, height: 28, borderRadius: 0.8, objectFit: 'cover', flexShrink: 0 }}
                />
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ color: 'primary.main', letterSpacing: -0.2, display: { xs: 'none', sm: 'block' } }}
                >
                  {siteName}
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                {isDesktop ? <ThemeModeButton /> : null}
                <Tooltip title="全局搜索">
                  <IconButton component={Link} to="/resources" color="inherit" size="small">
                    <Search size={18} />
                  </IconButton>
                </Tooltip>
                {user ? (
                  <Tooltip title={user.name || user.email || '我的'}>
                    <IconButton component={Link} to="/me" color="inherit" size="small">
                      <Avatar sx={{ width: 30, height: 30, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
                        {userInitial}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Button component={Link} to="/login" size="small" variant="outlined">
                    登录
                  </Button>
                )}
              </Box>
            </Toolbar>
          </Container>
        </AppBar>
      ) : isDesktop ? (
        <AppBar position="sticky" color="default" elevation={1}>
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ gap: 1 }}>
              <Box
                component={Link}
                to="/"
                sx={{
                  mr: 1.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  textDecoration: 'none',
                  color: 'inherit',
                  minWidth: 0,
                }}
              >
                <Box
                  component="img"
                  src={siteLogo}
                  alt={siteName}
                  sx={{ width: 30, height: 30, borderRadius: 0.8, objectFit: 'cover', flexShrink: 0 }}
                />
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ color: 'primary.main', letterSpacing: -0.5, userSelect: 'none' }}
                >
                  {siteName}
                </Typography>
              </Box>
              <Button
                component={Link}
                to="/"
                startIcon={<Home size={18} />}
                color={navValue === '/' ? 'primary' : 'inherit'}
                sx={{ fontWeight: navValue === '/' ? 700 : 400 }}
              >
                首页
              </Button>
              <Button
                component={Link}
                to="/resources"
                startIcon={<FolderSearch size={18} />}
                color={navValue === '/resources' ? 'primary' : 'inherit'}
                sx={{ fontWeight: navValue === '/resources' ? 700 : 400 }}
              >
                资源
              </Button>
              <Box sx={{ flex: 1 }} />
              <TextField
                size="small"
                placeholder="全局搜索"
                value={globalSearchInput}
                onChange={(e) => setGlobalSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleGlobalSearch();
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 260, mr: 1 }}
              />
              <Button size="small" variant="outlined" onClick={handleGlobalSearch}>
                搜索
              </Button>
              <ThemeModeButton />
              {user ? (
                <Tooltip title={user.name || user.email || '我的'}>
                  <IconButton component={Link} to="/me" color="inherit" size="small">
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem', bgcolor: 'primary.main' }}>
                      {userInitial}
                    </Avatar>
                  </IconButton>
                </Tooltip>
              ) : (
                <Button component={Link} to="/login" variant="outlined" size="small">
                  登录
                </Button>
              )}
            </Toolbar>
          </Container>
        </AppBar>
      ) : showMobileBottomNav ? (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
          }}
        >
          <BottomNavigation value={navValue} showLabels>
            <BottomNavigationAction
              component={Link}
              to="/"
              label="首页"
              value="/"
              icon={<Home size={22} />}
            />
            <BottomNavigationAction
              component={Link}
              to="/resources"
              label="资源"
              value="/resources"
              icon={<FolderSearch size={22} />}
            />
            {user ? (
              <BottomNavigationAction
                component={Link}
                to="/me"
                label="我的"
                value="/me"
                icon={<User size={22} />}
              />
            ) : (
              <BottomNavigationAction
                component={Link}
                to="/login"
                label="我的"
                value="/me"
                icon={<User size={22} />}
              />
            )}
          </BottomNavigation>
        </Paper>
      ) : null}
      {shouldAutoPrompt ? (
        <Container maxWidth="xl" sx={{ mt: 1.5, mb: -1 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight={600}>
                添加到设备
              </Typography>
              <Typography variant="caption" color="text.secondary">
                安装后可像原生应用一样从桌面快速打开并全屏使用。
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={dismissAutoPrompt}>
                取消
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<Download size={16} />}
                onClick={handleInstallPwa}
                disabled={installingPwa}
              >
                {installingPwa ? '处理中…' : '添加'}
              </Button>
            </Box>
          </Paper>
        </Container>
      ) : null}
      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 3, px: { xs: 2, md: 3 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
