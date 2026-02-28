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
} from '@mui/material';
import { Home, Film, User, ArrowLeft } from 'lucide-react';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAuthMe } from '../../api/auth';

const isDetailPage = (pathname: string) => /^\/videos\/\d+$/.test(pathname);

export function AppLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const onDetailPage = isDetailPage(pathname);

  const { data: user } = useQuery({
    queryKey: ['authMe'],
    queryFn: fetchAuthMe,
    staleTime: 5 * 60 * 1000,
  });

  const navValue =
    pathname === '/'
      ? '/'
      : pathname.startsWith('/videos')
        ? '/videos'
        : pathname === '/me'
          ? '/me'
          : pathname;

  const userInitial = (user?.name || user?.email || '?')[0].toUpperCase();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: onDetailPage ? 0 : { xs: 7, md: 0 } }}>
      {onDetailPage ? (
        <AppBar position="sticky" color="default" elevation={1}>
          <Container maxWidth="xl">
            <Toolbar disableGutters>
              <Button component={Link} to="/" startIcon={<ArrowLeft size={18} />} size="small">
                返回首页
              </Button>
              <Box sx={{ ml: 'auto' }}>
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
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ mr: 2, color: 'primary.main', letterSpacing: -0.5, userSelect: 'none' }}
              >
                AL Media
              </Typography>
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
                to="/videos"
                startIcon={<Film size={18} />}
                color={navValue === '/videos' ? 'primary' : 'inherit'}
                sx={{ fontWeight: navValue === '/videos' ? 700 : 400 }}
              >
                视频
              </Button>
              <Box sx={{ flex: 1 }} />
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
      ) : (
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
              to="/videos"
              label="视频"
              value="/videos"
              icon={<Film size={22} />}
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
      )}
      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 3, px: { xs: 2, md: 3 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
