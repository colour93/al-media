import { useEffect } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Clapperboard,
  Film,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Target,
  Tags,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { logout } from '../../api/auth';
import { useSidebarStore } from '../../stores/sidebar';
import { ThemeModeButton } from '../ThemeModeButton/ThemeModeButton';

const DRAWER_WIDTH = 180;
const TOOLBAR_HEIGHT = '64px';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard },
  { to: '/videos', label: '视频', icon: Clapperboard },
  { to: '/video-files', label: '视频文件', icon: Film },
  { to: '/file-dirs', label: '目录', icon: FolderOpen },
  { to: '/strategies', label: '策略', icon: Target },
  { to: '/tag-types', label: '标签类型', icon: Tags },
  { to: '/tags', label: '标签', icon: Tags },
  { to: '/actors', label: '演员', icon: Users },
  { to: '/creators', label: '创作者', icon: Users },
  { to: '/distributors', label: '发行方', icon: Users },
];

function NavLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const pathname = location.pathname;
  const isActive =
    item.to === '/'
      ? pathname === '/'
      : pathname === item.to || pathname.startsWith(`${item.to}/`);
  const Icon = item.icon;

  return (
    <ListItemButton
      component={Link}
      to={item.to}
      activeOptions={{ exact: item.to === '/' }}
      selected={isActive}
      sx={{
        borderRadius: 1,
        mx: 1,
        mb: 0.5,
        '&.active': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': { bgcolor: 'primary.dark' },
          '& .MuiListItemIcon-root': { color: 'inherit' },
        },
      }}
      activeProps={{ className: 'active' }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        <Icon size={20} strokeWidth={1.5} />
      </ListItemIcon>
      <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
    </ListItemButton>
  );
}

export function AdminLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { open, toggle, setOpen } = useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/login' });
  };

  useEffect(() => {
    if (!isDesktop) setOpen(false);
  }, [location.pathname, isDesktop, setOpen]);

  const drawerContent = (
    <Box sx={{ py: 2, px: 1 }}>
      <Typography variant="subtitle1" fontWeight={600} px={2} mb={1} color="text.secondary">
        管理
      </Typography>
      <List dense disablePadding>
        {navItems.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: open ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
          marginLeft: { md: open ? `${DRAWER_WIDTH}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={toggle}
            sx={{ mr: 2 }}
            aria-label="切换菜单"
          >
            <Menu size={24} />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            视频平台管理
          </Typography>
          <ThemeModeButton />
          <IconButton color="inherit" onClick={handleLogout} aria-label="退出登录">
            <LogOut size={22} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'persistent' : 'temporary'}
        open={open}
        onClose={() => !isDesktop && setOpen(false)}
        ModalProps={isDesktop ? undefined : { keepMounted: true }}
        sx={{
          width: isDesktop && open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            // top: { xs: 0, md: TOOLBAR_HEIGHT },
            // height: { xs: '100%', md: `calc(100% - ${TOOLBAR_HEIGHT}px)` },
            borderRight: 1,
            borderColor: 'divider',
            flexShrink: 0,
            transition: theme.transitions.create('transform', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
            ...(isDesktop && !open && {
              transform: 'translateX(-100%)',
            }),
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { md: open ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
          // marginLeft: { md: open ? `${DRAWER_WIDTH}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          marginTop: TOOLBAR_HEIGHT,
          // minHeight: `calc(100vh - ${TOOLBAR_HEIGHT}px)`,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
