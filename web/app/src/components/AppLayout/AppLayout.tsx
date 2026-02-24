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
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Home, Film, ArrowLeft, User } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAuthMe, logout } from '../../api/auth';

const isDetailPage = (pathname: string) => /^\/videos\/\d+$/.test(pathname);

export function AppLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const onDetailPage = isDetailPage(pathname);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { data: user } = useQuery({
    queryKey: ['authMe'],
    queryFn: fetchAuthMe,
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    queryClient.setQueryData(['authMe'], null);
    navigate({ to: '/login' });
  };

  const navValue =
    pathname === '/'
      ? '/'
      : pathname.startsWith('/videos')
        ? '/videos'
        : pathname === '/me'
          ? '/me'
          : pathname;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: onDetailPage ? 0 : { xs: 8, md: 0 } }}>
      {onDetailPage ? (
        <AppBar position="static" color="default" elevation={0} sx={{ mb: 0 }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters>
              <Button component={Link} to="/" startIcon={<ArrowLeft size={20} />} size="small">
                返回首页
              </Button>
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                {user ? (
                  <IconButton component={Link} to="/me" color="inherit" aria-label="我的">
                    <User size={22} />
                  </IconButton>
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
        <AppBar position="static" color="default" elevation={1} sx={{ mb: 2 }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ gap: 2 }}>
              <Button
                component={Link}
                to="/"
                startIcon={<Home size={20} />}
                color={navValue === '/' ? 'primary' : 'inherit'}
                sx={{ fontWeight: navValue === '/' ? 600 : 400 }}
              >
                首页
              </Button>
              <Button
                component={Link}
                to="/videos"
                startIcon={<Film size={20} />}
                color={navValue === '/videos' ? 'primary' : 'inherit'}
                sx={{ fontWeight: navValue === '/videos' ? 600 : 400 }}
              >
                视频
              </Button>
              {user && (
                <Button
                  component={Link}
                  to="/me"
                  startIcon={<User size={20} />}
                  color={navValue === '/me' ? 'primary' : 'inherit'}
                  sx={{ fontWeight: navValue === '/me' ? 600 : 400 }}
                >
                  我的
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
              icon={<Home size={24} />}
            />
            <BottomNavigationAction
              component={Link}
              to="/videos"
              label="视频"
              value="/videos"
              icon={<Film size={24} />}
            />
            {user ? (
              <BottomNavigationAction
                component={Link}
                to="/me"
                label="我的"
                value="/me"
                icon={<User size={24} />}
              />
            ) : (
              <BottomNavigationAction
                component={Link}
                to="/login"
                label="我的"
                value="/me"
                icon={<User size={24} />}
              />
            )}
          </BottomNavigation>
        </Paper>
      )}
      <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 2, px: { xs: 2, md: 3 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
