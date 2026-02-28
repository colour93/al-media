import { Box, Paper } from '@mui/material';
import ReactPlayer from 'react-player';
import { useEffect, useRef } from 'react';

interface MUIPlayerProps {
  url: string;
  /** 是否在移动端全宽 */
  fullWidth?: boolean;
  /** 初始跳转播放位置（秒） */
  initialSeekSeconds?: number;
  onTimeUpdate?: (currentSeconds: number, durationSeconds?: number) => void;
  onEnded?: () => void;
}

export function MUIPlayer({ url, fullWidth, initialSeekSeconds, onTimeUpdate, onEnded }: MUIPlayerProps) {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const appliedSeekRef = useRef<number | null>(null);

  useEffect(() => {
    pendingSeekRef.current = null;
    appliedSeekRef.current = null;
  }, [url]);

  useEffect(() => {
    if (initialSeekSeconds == null || initialSeekSeconds <= 0) return;
    if (appliedSeekRef.current != null) return;
    const target = Math.floor(initialSeekSeconds);
    const el = playerRef.current;
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      el.currentTime = Math.min(target, Math.max(0, Math.floor(el.duration - 1)));
      appliedSeekRef.current = target;
      pendingSeekRef.current = null;
      return;
    }
    pendingSeekRef.current = target;
  }, [initialSeekSeconds, url]);

  return (
    <Paper
      elevation={2}
      sx={{
        overflow: 'hidden',
        borderRadius: 2,
        width: fullWidth ? '100%' : { xs: '100%', md: 720, lg: 960 },
        maxWidth: '100%',
        aspectRatio: '16/9',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <ReactPlayer
          ref={playerRef}
          width="100%"
          height="100%"
          controls
          src={url}
          onLoadedMetadata={(event) => {
            const target = pendingSeekRef.current;
            if (target == null) return;
            const duration = event.currentTarget.duration;
            const safeTarget = Number.isFinite(duration) && duration > 0
              ? Math.min(target, Math.max(0, Math.floor(duration - 1)))
              : target;
            event.currentTarget.currentTime = safeTarget;
            appliedSeekRef.current = safeTarget;
            pendingSeekRef.current = null;
          }}
          onTimeUpdate={(event) => {
            if (!onTimeUpdate) return;
            const current = event.currentTarget.currentTime;
            const duration = event.currentTarget.duration;
            onTimeUpdate(current, Number.isFinite(duration) ? duration : undefined);
          }}
          onEnded={onEnded}
        />
      </Box>
    </Paper>
  );
}
