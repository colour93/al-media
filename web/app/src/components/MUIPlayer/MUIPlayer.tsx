import { Box, Paper } from '@mui/material';
import { useEffect, useRef } from 'react';
import { MediaPlayer, MediaPlayerInstance, MediaProvider, type MediaTimeUpdateEventDetail, type PlayerSrc } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface MUIPlayerProps {
  src: PlayerSrc;
  /** 是否在移动端全宽 */
  fullWidth?: boolean;
  /** 初始跳转播放位置（秒） */
  initialSeekSeconds?: number;
  onTimeUpdate?: (currentSeconds: number, durationSeconds?: number) => void;
  onEnded?: () => void;
}

export function MUIPlayer({ fullWidth, initialSeekSeconds, src, onTimeUpdate, onEnded }: MUIPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const onTimeUpdateRef = useRef<typeof onTimeUpdate>(onTimeUpdate);
  const onEndedRef = useRef<typeof onEnded>(onEnded);
  const pendingSeekRef = useRef<number | null>(null);
  const appliedSeekRef = useRef<number | null>(null);

  useEffect(() => {
    pendingSeekRef.current = null;
    appliedSeekRef.current = null;
  }, [src]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const seekIfNeeded = () => {
    if (initialSeekSeconds == null || initialSeekSeconds <= 0 || !playerRef.current) return;
    if (appliedSeekRef.current != null) return;
    const target = Math.floor(initialSeekSeconds);
    const duration = Number(playerRef.current.duration);
    const safeTarget =
      Number.isFinite(duration) && duration > 1
        ? Math.min(target, Math.max(0, Math.floor(duration - 1)))
        : target;
    playerRef.current.currentTime = safeTarget;
    appliedSeekRef.current = safeTarget;
    pendingSeekRef.current = null;
  };

  const onVdsTimeUpdate = (detail: MediaTimeUpdateEventDetail) => {
    if (!onTimeUpdateRef.current || !playerRef.current) return;
    const duration = Number(playerRef.current.duration);
    onTimeUpdateRef.current(detail.currentTime, Number.isFinite(duration) ? duration : undefined);
  };
  const onVdsEnded = () => {
    onEndedRef.current?.();
  };

  return (
    <Paper
      elevation={2}
      sx={{
        overflow: 'hidden',
        borderRadius: 2,
        width: fullWidth ? '100%' : { xs: '100%', md: 720, lg: 960 },
        maxWidth: '100%',
        aspectRatio: '16/9',
        bgcolor: 'black',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          bgcolor: 'black',
        }}
      >
        <MediaPlayer
          onCanPlay={seekIfNeeded}
          onTimeUpdate={onVdsTimeUpdate}
          onEnded={onVdsEnded}
          ref={playerRef}
          src={src}
        >
          <MediaProvider />
          <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>
      </Box>
    </Paper>
  );
}
