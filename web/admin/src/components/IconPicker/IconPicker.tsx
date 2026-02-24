import { useState, useEffect } from 'react';
import { Box, Typography, TextField, InputAdornment } from '@mui/material';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import { LUCIDE_ICON_OPTIONS } from '../../utils/lucideIcons';

export interface IconPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const iconNamesSet = new Set<string>(iconNames);

function isValidIconName(name: string): name is IconName {
  return iconNamesSet.has(name);
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [inputValue, setInputValue] = useState(value ?? '');
  useEffect(() => {
    setTimeout(() => {
      setInputValue(value ?? '');
    }, 0);
  }, [value]);

  const handleInputChange = (v: string) => {
    setInputValue(v);
    const trimmed = v.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    if (isValidIconName(trimmed)) {
      onChange(trimmed);
    }
  };

  const handleInputBlur = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (!isValidIconName(trimmed)) {
      onChange(null);
      setInputValue(value ?? '');
    }
  };

  const displayValue = value ?? inputValue;
  const isValid = displayValue ? isValidIconName(displayValue) : true;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        图标
      </Typography>
      <TextField
        size="small"
        placeholder="输入图标名称，如 Camera、Heart"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleInputBlur}
        error={!!inputValue && !isValid}
        helperText={inputValue && !isValid ? '非有效 Lucide 图标名' : undefined}
        fullWidth
        sx={{ mb: 1.5 }}
        InputProps={{
          startAdornment: displayValue && isValid ? (
            <InputAdornment position="start">
              <DynamicIcon name={displayValue as IconName} size={20} />
            </InputAdornment>
          ) : null,
        }}
      />
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box
          onClick={() => onChange(null)}
          sx={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
            border: 2,
            borderColor: value === null || value === '' ? 'primary.main' : 'divider',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          title="无图标"
        >
          <Typography variant="caption" color="text.secondary">
            无
          </Typography>
        </Box>
        {LUCIDE_ICON_OPTIONS.map(({ name, Icon }) => (
          <Box
            key={name}
            onClick={() => onChange(name)}
            sx={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              border: 2,
              borderColor: value === name ? 'primary.main' : 'divider',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            title={name}
          >
            <Icon size={20} strokeWidth={1.5} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
