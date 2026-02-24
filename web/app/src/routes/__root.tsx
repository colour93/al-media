import { createRootRoute } from '@tanstack/react-router';
import { AppLayout } from '../components/AppLayout/AppLayout';

export const Route = createRootRoute({
  component: AppLayout,
});
