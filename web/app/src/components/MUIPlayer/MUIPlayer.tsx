import { Box, Paper } from "@mui/material";
import {
  type MouseEvent,
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Gesture,
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

const DOUBLE_TAP_SEEK_SECONDS = 5;
const SEEK_TOAST_DURATION_MS = 650;

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [seekToastText, setSeekToastText] = useState<string | null>(null);
  const seekToastTimerRef = useRef<number | null>(null);
  const isMobileFullscreen = isFullscreen && isCoarsePointer;

  useEffect(() => {
    appliedSeekRef.current = null;
  }, [src]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const updateCoarsePointer = () => {
      setIsCoarsePointer(
        coarseQuery.matches || window.navigator.maxTouchPoints > 0,
      );
    };

    updateCoarsePointer();

    if (typeof coarseQuery.addEventListener === "function") {
      coarseQuery.addEventListener("change", updateCoarsePointer);
      return () => coarseQuery.removeEventListener("change", updateCoarsePointer);
    }

    coarseQuery.addListener(updateCoarsePointer);
    return () => coarseQuery.removeListener(updateCoarsePointer);
  }, []);

  const clearSeekToastTimer = useCallback(() => {
    if (seekToastTimerRef.current == null) return;
    window.clearTimeout(seekToastTimerRef.current);
    seekToastTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearSeekToastTimer();
    };
  }, [clearSeekToastTimer]);

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

  const syncFullscreenState = useCallback(() => {
    const nextFullscreen = Boolean(playerRef.current?.state.fullscreen);
    if (!nextFullscreen) {
      setSeekToastText(null);
      clearSeekToastTimer();
    }
    setIsFullscreen((prev) =>
      prev === nextFullscreen ? prev : nextFullscreen,
    );
  }, [clearSeekToastTimer]);

  const showSeekToast = useCallback(
    (text: string) => {
      setSeekToastText(text);
      clearSeekToastTimer();
      seekToastTimerRef.current = window.setTimeout(() => {
        setSeekToastText((prev) => (prev === text ? null : prev));
      }, SEEK_TOAST_DURATION_MS);
    },
    [clearSeekToastTimer],
  );

  const isControlTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        ".vds-controls, .vds-menu, button, [role='button'], [role='slider'], input, select, textarea",
      ),
    );
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!isMobileFullscreen) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePlayerTouchStartCapture = (event: TouchEvent<HTMLElement>) => {
    if (!isMobileFullscreen) return;
    if (isControlTarget(event.target)) return;
    event.preventDefault();
  };

  const handleSeekBackwardTrigger = () => {
    showSeekToast(`-${DOUBLE_TAP_SEEK_SECONDS}s`);
  };

  const handleSeekForwardTrigger = () => {
    showSeekToast(`+${DOUBLE_TAP_SEEK_SECONDS}s`);
  };

  const handleCanPlay = () => {
    seekIfNeeded();
    syncVideoOrientation();
    syncFullscreenState();
  };

  const handleLoadStart = () => {
    setIsPortraitVideo(false);
    setIsFullscreen(false);
    setSeekToastText(null);
    clearSeekToastTimer();
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
          '& [data-media-player][data-fullscreen]': {
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          },
          '& [data-media-player][data-fullscreen] [data-media-provider] video':
            {
              pointerEvents: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            },
          '& [data-media-player][data-fullscreen] .mui-player-touch-gestures .vds-gesture':
            {
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "auto !important",
            },
          '& [data-media-player][data-fullscreen] .mui-player-touch-gestures .vds-gesture[action="seek:-5"]':
            {
              width: "50%",
              zIndex: 1,
            },
          '& [data-media-player][data-fullscreen] .mui-player-touch-gestures .vds-gesture[action="seek:5"]':
            {
              left: "unset",
              right: 0,
              width: "50%",
              zIndex: 1,
            },
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
          onFullscreenChange={syncFullscreenState}
          onTimeUpdate={onVdsTimeUpdate}
          onEnded={onVdsEnded}
          onContextMenu={handleContextMenu}
          onContextMenuCapture={handleContextMenu}
          onTouchStartCapture={handlePlayerTouchStartCapture}
          ref={playerRef}
          src={src}
          data-portrait-video={isPortraitVideo ? "true" : undefined}
        >
          <MediaProvider
            mediaProps={{
              onContextMenu: handleContextMenu,
              onTouchStart: handlePlayerTouchStartCapture,
              style: isMobileFullscreen
                ? {
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }
                : undefined,
            }}
          />
          {isMobileFullscreen ? (
            <div className="vds-gestures mui-player-touch-gestures">
              <Gesture
                className="vds-gesture"
                event="dblpointerup"
                action={`seek:-${DOUBLE_TAP_SEEK_SECONDS}`}
                onTrigger={handleSeekBackwardTrigger}
              />
              <Gesture
                className="vds-gesture"
                event="dblpointerup"
                action={`seek:${DOUBLE_TAP_SEEK_SECONDS}`}
                onTrigger={handleSeekForwardTrigger}
              />
            </div>
          ) : null}
          <DefaultVideoLayout
            icons={defaultLayoutIcons}
            noGestures={isMobileFullscreen}
          />
        </MediaPlayer>
        {isMobileFullscreen && seekToastText ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 999,
                bgcolor: "rgba(0,0,0,0.58)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 20,
                lineHeight: 1,
                letterSpacing: 0.2,
                backdropFilter: "blur(2px)",
              }}
            >
              {seekToastText}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}
