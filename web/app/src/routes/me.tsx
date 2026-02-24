import { createFileRoute, redirect } from '@tanstack/react-router';
import { Box, Paper, Typography, Button } from '@mui/material';
import { User, LogOut } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fetchAuthMe, logout } from '../api/auth';

export const Route = createFileRoute('/me')({
  beforeLoad: async () => {
    const user = await fetchAuthMe();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  component: MePage,
});

function MePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ['authMe'],
    queryFn: fetchAuthMe,
  });

  const handleLogout = async () => {
    await logout();
    queryClient.setQueryData(['authMe'], null);
    navigate({ to: '/login' });
  };

  if (!user) return null;

  const displayName = user.name || user.email || '用户';

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
          <Button variant="outlined" color="error" startIcon={<LogOut size={18} />} onClick={handleLogout}>
            退出登录
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
