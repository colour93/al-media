import { useBanner, useRecommended, useLatest } from './useVideos';

export function useHomeData(latestPage = 1, latestPageSize = 12) {
  const banner = useBanner();
  const recommended = useRecommended();
  const latest = useLatest(latestPage, latestPageSize);

  return {
    banner,
    recommended,
    latest,
    isLoading: banner.isLoading || recommended.isLoading || latest.isLoading,
  };
}
