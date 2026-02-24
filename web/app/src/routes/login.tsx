import { createFileRoute, useLocation } from '@tanstack/react-router';
import { Box, Button, Paper, Typography } from '@mui/material';
import { LogIn } from 'lucide-react';
import { getOidcAuthorizeUrl } from '../api/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function getErrorFromSearch(search: string): string | undefined {
  const params = new URLSearchParams(search);
  return params.get('error') ?? undefined;
}

const ERROR_MESSAGES: Record<string, string> = {
  oidc_not_configured: 'OIDC 未配置',
  missing_params: '登录参数缺失',
  no_pkce_state: '登录会话已过期，请重试',
  invalid_pkce: '登录数据无效。请清除 Cookie 或使用无痕模式重试',
  state_mismatch: '安全校验失败',
  token_exchange_failed: '令牌交换失败',
  unauthorized: '您的账号暂无访问权限',
};

function LoginPage() {
  const location = useLocation();
  const errorKey = getErrorFromSearch(location.search);
  const errorMsg = errorKey ? ERROR_MESSAGES[errorKey] ?? '登录失败' : undefined;

  const handleLogin = () => {
    window.location.href = getOidcAuthorizeUrl();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h5" fontWeight={600} gutterBottom textAlign="center">
          登录
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }} textAlign="center">
          使用 OIDC 账号登录
        </Typography>
        {errorMsg && (
          <Typography
            variant="body2"
            color="error"
            sx={{ mb: 2, p: 1.5, bgcolor: 'error.light', borderRadius: 1 }}
          >
            {errorMsg}
          </Typography>
        )}
        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<LogIn size={20} />}
          onClick={handleLogin}
          sx={{ py: 1.5 }}
        >
          OIDC 登录
        </Button>
      </Paper>
    </Box>
  );
}
