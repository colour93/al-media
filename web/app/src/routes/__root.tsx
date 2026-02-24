import { createRootRoute, redirect, Outlet, useRouterState } from '@tanstack/react-router';
import { AppLayout } from '../components/AppLayout/AppLayout';
import { fetchAuthConfig, fetchAuthMe } from '../api/auth';

function RootComponent() {
  const { location } = useRouterState();
  if (location.pathname === '/login') {
    return <Outlet />;
  }
  return <AppLayout />;
}

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') return;
    const config = await fetchAuthConfig();
    if (!config.requireLogin) return;
    const user = await fetchAuthMe();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  component: RootComponent,
});
