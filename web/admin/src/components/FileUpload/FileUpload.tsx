import { useState, useRef } from 'react';
import { Box, Button, Typography, Avatar } from '@mui/material';
import { Upload } from 'lucide-react';
import { uploadFile, getFileUrl } from '../../api/file';
import type { FileCategory } from '../../api/types';

export interface FileUploadProps {
  category: FileCategory;
  value: string | null;
  onChange: (key: string | null) => void;
  accept?: string;
  label?: string;
  previewSize?: number;
}

export function FileUpload({
  category,
  value,
  onChange,
  accept = 'image/*',
  label = '上传',
  previewSize = 80,
}: FileUploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = value ? getFileUrl(category, value) : null;

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { key } = await uploadFile(file, category);
      onChange(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleSelect}
          style={{ display: 'none' }}
        />
        {previewUrl && (
          <Avatar
            src={previewUrl}
            variant="rounded"
            sx={{ width: previewSize, height: previewSize }}
            onClick={() => inputRef.current?.click()}
            style={{ cursor: loading ? 'wait' : 'pointer' }}
          />
        )}
        <Box>
          <Button
            variant="outlined"
            component="span"
            startIcon={<Upload size={16} />}
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {value ? '更换' : label}
          </Button>
          {value && (
            <Button size="small" sx={{ ml: 1 }} onClick={handleClear} disabled={loading}>
              清除
            </Button>
          )}
        </Box>
      </Box>
      {error && <Typography color="error" variant="caption">{error}</Typography>}
      {loading && <Typography variant="caption" color="text.secondary">上传中…</Typography>}
    </Box>
  );
}
