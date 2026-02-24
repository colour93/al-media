import { createRootRoute, redirect, Outlet, useRouterState } from '@tanstack/react-router';
import { AdminLayout } from '../components/AdminLayout/AdminLayout';
import { fetchAuthMe } from '../api/auth';

function RootComponent() {
  const { location } = useRouterState();
  if (location.pathname === '/login') {
    return <Outlet />;
  }
  return <AdminLayout />;
}

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') return;
    const user = await fetchAuthMe();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  component: RootComponent,
});
