import { createRootRoute } from '@tanstack/react-router';
import { AdminLayout } from '../components/AdminLayout/AdminLayout';

export const Route = createRootRoute({
  component: AdminLayout,
});
