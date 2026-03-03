import { get } from './client';
import type { DashboardStats, DashboardTimeUnit } from './types';

const BASE = '/dashboard';

export async function fetchDashboardStats(params?: {
  unit?: DashboardTimeUnit;
  span?: number;
}): Promise<DashboardStats> {
  const query: Record<string, string | number> = {};
  if (params?.unit) query.unit = params.unit;
  if (params?.span != null) query.span = params.span;
  return get<DashboardStats>(`${BASE}/stats`, query);
}

