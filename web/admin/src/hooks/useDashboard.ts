import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '../api/dashboard';
import type { DashboardTimeUnit } from '../api/types';

const KEYS = {
  stats: (unit: DashboardTimeUnit, span?: number) => ['dashboard', 'stats', unit, span] as const,
};

export function useDashboardStats(unit: DashboardTimeUnit, span?: number) {
  return useQuery({
    queryKey: KEYS.stats(unit, span),
    queryFn: () => fetchDashboardStats({ unit, span }),
    refetchInterval: 5000,
  });
}

