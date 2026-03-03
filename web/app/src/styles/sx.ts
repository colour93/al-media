import type { Theme } from "@emotion/react";
import type { SxProps } from "@mui/material";

export const videoGridSx: SxProps<Theme> = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, 1fr)',
    sm: 'repeat(3, 1fr)',
    md: 'repeat(4, 1fr)',
    lg: 'repeat(5, 1fr)',
    xl: 'repeat(6, 1fr)',
  },
  gap: 2,
};