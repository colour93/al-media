import { get } from './client';

export interface CommonMetadata {
  adminPanelUrl: string;
}

export async function fetchCommonMetadata(): Promise<CommonMetadata> {
  return get<CommonMetadata>('/metadata');
}
