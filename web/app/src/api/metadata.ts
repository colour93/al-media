import { get } from './client';
import type { SiteConfig } from '../config/site';

export interface CommonMetadata {
  adminPanelUrl: string;
  site?: SiteConfig;
}

export async function fetchCommonMetadata(): Promise<CommonMetadata> {
  return get<CommonMetadata>('/metadata');
}
