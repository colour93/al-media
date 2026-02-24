import { Box, TextField, Typography } from '@mui/material';
import { TAG_COLOR_PRESETS } from '../../utils/tagColors';

export interface ColorPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  allowCustom?: boolean;
}

export function ColorPicker({ value, onChange, allowCustom = true }: ColorPickerProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        颜色
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          mb: allowCustom ? 2 : 0,
        }}
      >
        <Box
          onClick={() => onChange(null)}
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            border: 2,
            borderColor: value === null || value === '' ? 'primary.main' : 'divider',
            cursor: 'pointer',
            '&:hover': { opacity: 0.8 },
          }}
          title="无颜色"
        />
        {TAG_COLOR_PRESETS.map(({ value: v, label }) => (
          <Box
            key={v}
            onClick={() => onChange(v)}
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: v,
              border: 2,
              borderColor: value === v ? 'primary.main' : 'transparent',
              cursor: 'pointer',
              '&:hover': { opacity: 0.9 },
            }}
            title={label}
          />
        ))}
      </Box>
      {allowCustom && (
        <TextField
          size="small"
          label="自定义 (hex)"
          value={value && !TAG_COLOR_PRESETS.some((p) => p.value === value) ? value : ''}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v || null);
          }}
          placeholder="#ffffff"
          fullWidth
        />
      )}
    </Box>
  );
}
