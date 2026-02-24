import { createFileRoute } from '@tanstack/react-router';
import { Box, Paper, Typography } from '@mui/material';
import { LayoutDashboard } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        仪表盘
      </Typography>
      <Paper
        sx={{
          p: 3,
          mt: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        <LayoutDashboard size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.5 }} />
        <Typography variant="body1">欢迎使用视频平台管理后台</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          请从左侧菜单选择功能
        </Typography>
      </Paper>
    </Box>
  );
}
