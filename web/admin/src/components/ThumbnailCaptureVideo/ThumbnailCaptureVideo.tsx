import { useRef, useState, useEffect } from 'react';
import { Box, Button, Slider, Typography } from '@mui/material';
import { Camera } from 'lucide-react';

export interface ThumbnailCaptureVideoProps {
  videoUrl: string;
  videoDuration?: number;
  onCapture: (seekSec: number) => Promise<void>;
  disabled?: boolean;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ThumbnailCaptureVideo({
  videoUrl,
  videoDuration,
  onCapture,
  disabled = false,
}: ThumbnailCaptureVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [seekSec, setSeekSec] = useState(0);
  const [duration, setDuration] = useState(videoDuration ?? 60);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (videoDuration != null && videoDuration > 0) {
      setDuration(videoDuration);
    }
  }, [videoDuration]);

  const maxDuration = duration > 0 ? duration : 60;

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v && !Number.isNaN(v.currentTime)) {
      setSeekSec(v.currentTime);
    }
  };

  const handleSliderChange = (_: unknown, value: number | number[]) => {
    const sec = typeof value === 'number' ? value : value[0] ?? 0;
    setSeekSec(sec);
    const v = videoRef.current;
    if (v) {
      v.currentTime = sec;
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.duration && !Number.isNaN(v.duration)) {
      const d = Math.floor(v.duration);
      setDuration(d);
      if (seekSec <= 0 || seekSec > d) {
        const initSec = Math.min(1, d);
        setSeekSec(initSec);
        v.currentTime = initSec;
      }
    }
  };

  const handleCapture = async () => {
    const sec = Math.max(0, Math.min(seekSec, maxDuration));
    setCapturing(true);
    try {
      await onCapture(sec);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        component="video"
        ref={videoRef}
        controls
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        sx={{
          width: '100%',
          maxHeight: 200,
          borderRadius: 1,
          bgcolor: 'black',
          display: 'block',
        }}
        src={videoUrl}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Slider
          value={seekSec}
          min={0}
          max={maxDuration}
          step={0.5}
          onChange={handleSliderChange}
          size="small"
          sx={{ flex: 1 }}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => formatTime(v)}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
          {formatTime(seekSec)}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Camera size={14} />}
          onClick={handleCapture}
          disabled={disabled || capturing}
        >
          截取此帧
        </Button>
      </Box>
    </Box>
  );
}
