import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Search } from 'lucide-react';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useVideosList } from '../hooks/useVideos';

export const Route = createFileRoute('/videos/')({
  validateSearch: (s: Record<string, unknown>) => ({
    page: Number(s?.page) || 1,
    pageSize: Number(s?.pageSize) || 12,
    q: (s?.q as string) ?? '',
  }),
  component: VideosListPage,
});

function VideosListPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, q } = Route.useSearch();
  const [searchInput, setSearchInput] = useState(q);

  const { data, isLoading } = useVideosList(page, pageSize, {
    q: q || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        视频列表
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="搜索视频…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              navigate({ search: { page: 1, pageSize, q: searchInput || undefined } });
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>每页</InputLabel>
          <Select
            value={pageSize}
            label="每页"
            onChange={(e) =>
              navigate({ search: { page: 1, pageSize: Number(e.target.value), q: q || undefined } })
            }
          >
            <MenuItem value={12}>12</MenuItem>
            <MenuItem value={24}>24</MenuItem>
            <MenuItem value={48}>48</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
                lg: 'repeat(5, 1fr)',
                xl: 'repeat(6, 1fr)',
              },
              gap: 2,
            }}
          >
            {items.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </Box>
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) =>
                  navigate({ search: { page: p, pageSize, q: q || undefined } })
                }
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
