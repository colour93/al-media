import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import { X } from 'lucide-react';
import { getVideoSignUrl } from '../../api/file';
import { fetchVideo } from '../../api/videos';

export interface VideoPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  videoFileId?: number | null;
  videoId?: number | null;
}

export function VideoPreviewDialog({
  open,
  onClose,
  videoFileId,
  videoId,
}: VideoPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      setError(null);
      return;
    }

    const loadUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        if (videoFileId) {
          const res = await getVideoSignUrl(videoFileId);
          setUrl(res.url);
        } else if (videoId) {
          const video = await fetchVideo(videoId);
          if (video.videoFileUrl) {
            setUrl(video.videoFileUrl);
          } else {
            setError('该视频暂无关联文件');
          }
        } else {
          setError('缺少视频信息');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取播放地址失败');
        setUrl(null);
      } finally {
        setLoading(false);
      }
    };

    loadUrl();
  }, [open, videoFileId, videoId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        视频预览
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360, p: 4 }}>
            <CircularProgress size={48} />
          </Box>
        ) : error ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360, p: 4 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : url ? (
          <Box
            component="video"
            controls
            autoPlay
            sx={{ width: '100%', maxHeight: '70vh', display: 'block' }}
            src={url}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
