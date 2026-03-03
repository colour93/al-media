import { Box, Paper } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MediaPlayer,
  MediaPlayerInstance,
  MediaProvider,
  type MediaTimeUpdateEventDetail,
  type PlayerSrc,
} from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

interface MUIPlayerProps {
  src: PlayerSrc;
  /** 是否在移动端全宽 */
  fullWidth?: boolean;
  /** 初始跳转播放位置（秒） */
  initialSeekSeconds?: number;
  onTimeUpdate?: (currentSeconds: number, durationSeconds?: number) => void;
  onEnded?: () => void;
}

export function MUIPlayer({
  fullWidth,
  initialSeekSeconds,
  src,
  onTimeUpdate,
  onEnded,
}: MUIPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const onTimeUpdateRef = useRef<typeof onTimeUpdate>(onTimeUpdate);
  const onEndedRef = useRef<typeof onEnded>(onEnded);
  const appliedSeekRef = useRef<number | null>(null);
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);

  useEffect(() => {
    appliedSeekRef.current = null;
  }, [src]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // const syncVideoOrientation = useCallback(() => {
  //   const player = playerRef.current;
  //   if (!player) return;
  //   const stateWidth = Number(player.state.mediaWidth);
  //   const stateHeight = Number(player.state.mediaHeight);
  //   const media = player.el?.querySelector('video') as HTMLVideoElement | null;
  //   const width = stateWidth > 0 ? stateWidth : (media?.videoWidth ?? 0);
  //   const height = stateHeight > 0 ? stateHeight : (media?.videoHeight ?? 0);
  //   if (!(width > 0 && height > 0)) return;
  //   const nextPortrait = height > width;
  //   setIsPortraitVideo((prev) => (prev === nextPortrait ? prev : nextPortrait));
  // }, []);

  const syncVideoOrientation = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    const width = Number(player.state.mediaWidth);
    const height = Number(player.state.mediaHeight);

    // state 中已有数据时，无需查询 DOM
    if (width > 0 && height > 0) {
      const nextPortrait = height > width;
      setIsPortraitVideo((prev) =>
        prev === nextPortrait ? prev : nextPortrait,
      );
      return;
    }

    // 仅在 state 不可用时才回退到 DOM
    const media = player.el?.querySelector("video") as HTMLVideoElement | null;
    const domWidth = media?.videoWidth ?? 0;
    const domHeight = media?.videoHeight ?? 0;
    if (!(domWidth > 0 && domHeight > 0)) return;

    const nextPortrait = domHeight > domWidth;
    setIsPortraitVideo((prev) => (prev === nextPortrait ? prev : nextPortrait));
  }, []);

  const seekIfNeeded = () => {
    if (
      initialSeekSeconds == null ||
      initialSeekSeconds <= 0 ||
      !playerRef.current
    )
      return;
    if (appliedSeekRef.current != null) return;
    const target = Math.floor(initialSeekSeconds);
    const duration = Number(playerRef.current.duration);
    const safeTarget =
      Number.isFinite(duration) && duration > 1
        ? Math.min(target, Math.max(0, Math.floor(duration - 1)))
        : target;
    playerRef.current.currentTime = safeTarget;
    appliedSeekRef.current = safeTarget;
  };

  const onVdsTimeUpdate = (detail: MediaTimeUpdateEventDetail) => {
    if (!onTimeUpdateRef.current || !playerRef.current) return;
    const duration = Number(playerRef.current.duration);
    onTimeUpdateRef.current(
      detail.currentTime,
      Number.isFinite(duration) ? duration : undefined,
    );
  };
  const onVdsEnded = () => {
    onEndedRef.current?.();
  };

  const handleCanPlay = () => {
    seekIfNeeded();
    syncVideoOrientation();
  };

  const handleLoadStart = () => {
    setIsPortraitVideo(false);
  };

  return (
    <Paper
      elevation={2}
      sx={{
        overflow: "hidden",
        borderRadius: 2,
        width: fullWidth ? "100%" : { xs: "100%", md: 720, lg: 960 },
        maxWidth: "100%",
        aspectRatio: "16/9",
        bgcolor: "black",
        "@media (pointer: coarse)": {
          '& [data-media-player][data-fullscreen][data-orientation="portrait"][data-portrait-video="true"] [data-media-provider]':
            {
              overflow: "hidden",
            },
          '& [data-media-player][data-fullscreen][data-orientation="portrait"][data-portrait-video="true"] [data-media-provider] video':
            {
              objectFit: "cover",
            },
          '& [data-media-player][data-fullscreen][data-orientation="portrait"][data-portrait-video="true"] .vds-poster, & [data-media-player][data-fullscreen][data-orientation="portrait"][data-portrait-video="true"] .vds-poster img':
            {
              objectFit: "cover",
            },
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          bgcolor: "black",
        }}
      >
        <MediaPlayer
          playsInline
          fullscreenOrientation="none"
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onLoadedMetadata={syncVideoOrientation}
          onTimeUpdate={onVdsTimeUpdate}
          onEnded={onVdsEnded}
          ref={playerRef}
          src={src}
          data-portrait-video={isPortraitVideo ? "true" : undefined}
        >
          <MediaProvider />
          <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>
      </Box>
    </Paper>
  );
}
