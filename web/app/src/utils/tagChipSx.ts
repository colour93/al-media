import type { SxProps, Theme } from '@mui/material/styles';

interface TagChipSxOptions {
  maxWidth?: number;
}

export function getTagChipSx(color?: string | null, options: TagChipSxOptions = {}): SxProps<Theme> {
  const { maxWidth } = options;
  return (theme) => {
    const tagColor = color?.trim();
    return {
      bgcolor: tagColor ?? theme.palette.action.selected,
      color: tagColor ? theme.palette.getContrastText(tagColor) : undefined,
      '& .MuiChip-label': { color: 'inherit' },
      '& .MuiChip-icon': { color: 'inherit' },
      maxWidth,
    };
  };
}
