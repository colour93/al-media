import { Box, Paper } from '@mui/material';
import ReactPlayer from 'react-player';

interface MUIPlayerProps {
  url: string;
  /** 是否在移动端全宽 */
  fullWidth?: boolean;
}

export function MUIPlayer({ url, fullWidth }: MUIPlayerProps) {
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
          width="100%"
          height="100%"
          controls
          
          src={url}
        />
      </Box>
    </Paper>
  );
}
