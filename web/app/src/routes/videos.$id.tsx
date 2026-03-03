import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Heart } from 'lucide-react';
import { MUIPlayer } from '../components/MUIPlayer/MUIPlayer';
import { VideoSidebarCard } from '../components/VideoSidebarCard/VideoSidebarCard';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { fetchAuthMe } from '../api/auth';
import {
  useVideo,
  useRecommended,
  useLatest,
  useVideoInteraction,
  useSetVideoFavorite,
  useUpsertVideoHistory,
} from '../hooks/useVideos';
import type { VideoMimeType } from '@vidstack/react';
import { useRequest } from 'ahooks';
import { formatDurationFromSeconds } from '../utils/format';

export const Route = createFileRoute('/videos/$id')({
  component: VideoDetailPage,
});

/** 确保视频 URL 可播放（相对路径需转为绝对 URL） */
function toPlayableUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return url;
}

function inferVideoMimeType(fileKey?: string | null): VideoMimeType | undefined {
  if (!fileKey) return undefined;
  const dot = fileKey.lastIndexOf('.');
  if (dot < 0) return undefined;
  const ext = fileKey.slice(dot + 1).toLowerCase();
  const map: Record<string, VideoMimeType> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',

    mov: 'video/mp4',
    avi: 'video/avi',
    webm: 'video/webm',

    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
  };
  return map[ext];
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function VideoDetailPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const videoId = Number(id);
  const isValidId = Number.isInteger(videoId);

  const { data: video, isLoading } = useVideo(isValidId ? videoId : null);
  const { data: recommended } = useRecommended();
  const { data: latestData } = useLatest(1, 12);
  const { data: user } = useQuery({
    queryKey: ['authMe'],
    queryFn: fetchAuthMe,
  });
  const { data: interaction } = useVideoInteraction(isValidId ? videoId : null, isValidId && !!user);
  const setFavorite = useSetVideoFavorite(isValidId ? videoId : 0);
  const upsertHistory = useUpsertVideoHistory(isValidId ? videoId : 0, { invalidateAfterSuccess: false });
  const lastReportedAtRef = useRef(0);
  const lastReportedSecondsRef = useRef(0);

  const sidebarVideos = useMemo(() => {
    const rec = recommended ?? [];
    const lat = latestData?.items ?? [];
    const combined = [...rec];
    for (const v of lat) {
      if (!combined.some((c) => c.id === v.id)) combined.push(v);
    }
    return combined.filter((v) => v.id !== videoId).slice(0, 12);
  }, [recommended, latestData, videoId]);

  const playUrl = useMemo(
    () => (video?.videoFileUrl ? toPlayableUrl(video.videoFileUrl) : ''),
    [video]
  );
  const sourceType = useMemo(
    () => inferVideoMimeType(video?.videoFileKey) ?? 'video/mp4',
    [video?.videoFileKey]
  );
  const resumeSeconds = interaction?.history?.progressSeconds && interaction.history.progressSeconds > 0
    ? interaction.history.progressSeconds
    : undefined;
  const playbackText = interaction?.history
    ? `上次看到 ${formatDurationFromSeconds(interaction.history.progressSeconds)}${interaction.history.completed ? '（已看完）' : ''}`
    : '';

  const handleFavoriteClick = () => {
    if (!user) {
      navigate({ to: '/login' });
      return;
    }
    setFavorite.mutate(!interaction?.isFavorite);
  };

  const { run: handleTimeUpdate } = useRequest(async (currentSeconds: number, durationSeconds?: number) => {
    if (!user || upsertHistory.isPending) return;
    const rounded = Math.floor(currentSeconds);
    if (rounded <= 0) return;
    const now = Date.now();
    const shouldThrottle =
      Math.abs(rounded - lastReportedSecondsRef.current) < 5 &&
      now - lastReportedAtRef.current < 8000;
    if (shouldThrottle) return;
    lastReportedAtRef.current = now;
    lastReportedSecondsRef.current = rounded;
    upsertHistory.mutate({
      progressSeconds: rounded,
      durationSeconds: durationSeconds != null ? Math.floor(durationSeconds) : undefined,
    });
  }, {
    throttleWait: 5000,
    manual: true,
  });

  const handleEnded = () => {
    if (!user) return;
    const endedSeconds = video?.videoDuration != null
      ? Math.floor(video.videoDuration)
      : Math.max(0, lastReportedSecondsRef.current);
    lastReportedAtRef.current = Date.now();
    lastReportedSecondsRef.current = endedSeconds;
    upsertHistory.mutate({
      progressSeconds: endedSeconds,
      durationSeconds: video?.videoDuration != null ? Math.floor(video.videoDuration) : undefined,
      completed: true,
    });
  };

  if (!isValidId) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">视频不存在</Typography>
      </Box>
    );
  }
  if (isLoading || !video) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const metaParts = [formatDurationFromSeconds(video.videoDuration), formatFileSize(video.fileSize)].filter(Boolean).join(' · ');
  const hasCreators = (video.creators?.length ?? 0) > 0;
  const hasActors = (video.actors?.length ?? 0) > 0;
  const hasTags = (video.tags?.length ?? 0) > 0;
  const hasDistributors = (video.distributors?.length ?? 0) > 0;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' },
        gap: { xs: 2, lg: 3 },
        alignItems: 'start',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {playUrl && (
          <Box sx={{ mb: 2 }}>
            <MUIPlayer
              src={{ src: playUrl, type: sourceType }}
              fullWidth
              initialSeekSeconds={resumeSeconds}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
            />
          </Box>
        )}
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, md: 2 },
            borderRadius: 2.5,
          }}
        >
          <Typography variant="h5" fontWeight={600} gutterBottom>
            {video.title}
          </Typography>
          {metaParts && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {metaParts}
            </Typography>
          )}
          {video.webCompatible === false && (
            <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
              当前文件可能无法在浏览器中稳定播放：
              {(video.webCompatibilityIssues ?? []).join('；') || '建议使用兼容格式重新编码。'}
            </Alert>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Button
              size="small"
              variant={interaction?.isFavorite ? 'contained' : 'outlined'}
              color={interaction?.isFavorite ? 'error' : 'primary'}
              onClick={handleFavoriteClick}
              disabled={setFavorite.isPending}
              startIcon={<Heart size={16} fill={interaction?.isFavorite ? 'currentColor' : 'none'} />}
            >
              {interaction?.isFavorite ? '已收藏' : '收藏'}
            </Button>
            {playbackText ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
              >
                <Clock3 size={14} />
                {playbackText}
              </Typography>
            ) : null}
          </Box>
          {hasTags || hasDistributors ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {video.tags?.map((t) => (
                <EntityPreview key={t.id} entityType="tag" entity={t} size="sm" />
              ))}
              {hasDistributors ? (
                <Typography variant="body2" color="text.secondary">
                  发行: {video.distributors?.map((d) => d.name).join('、')}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          {hasCreators || hasActors ? (
            <>
              <Divider sx={{ my: 1.5 }} />
              {hasCreators ? (
                <Box sx={{ mb: hasActors ? 1.5 : 0 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    创作者
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {video.creators?.map((c) => (
                      <EntityPreview key={c.id} entityType="creator" entity={c} size="sm" />
                    ))}
                  </Box>
                </Box>
              ) : null}
              {hasActors ? (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    演员
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1.5, justifyContent: 'flex-start' }}>
                    {video.actors?.map((a) => (
                      <EntityPreview key={a.id} entityType="actor" entity={a} size="md" layout="card" />
                    ))}
                  </Box>
                </Box>
              ) : null}
            </>
          ) : null}
        </Paper>
      </Box>
      {sidebarVideos.length > 0 ? (
        <Box
          sx={{
            minWidth: 0,
            width: '100%',
            maxWidth: { xs: 560, xl: 'none' },
            mx: { xs: 'auto', xl: 0 },
            position: { xl: 'sticky' },
            top: { xl: 84 },
          }}
        >
          <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ px: 0.5, pb: 0.5 }}>
              你可能还想看
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {sidebarVideos.map((v) => (
                <VideoSidebarCard key={v.id} video={v} />
              ))}
            </Box>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
}
