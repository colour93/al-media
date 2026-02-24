import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Pagination,
  Chip,
} from '@mui/material';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { useCreator, useCreatorVideos } from '../hooks/useEntities';

export const Route = createFileRoute('/creators/$id')({
  validateSearch: (s: Record<string, unknown>) => ({
    page: Number(s?.page) || 1,
  }),
  component: CreatorDetailPage,
});

function CreatorDetailPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { id } = Route.useParams();
  const { page } = Route.useSearch();
  const creatorId = Number(id);
  const pageSize = 12;

  const { data: creator, isLoading } = useCreator(Number.isInteger(creatorId) ? creatorId : null);
  const { data: videosData } = useCreatorVideos(
    Number.isInteger(creatorId) ? creatorId : null,
    page,
    pageSize
  );

  const videos = videosData?.items ?? [];
  const total = videosData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (!Number.isInteger(creatorId)) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">创作者不存在</Typography>
      </Box>
    );
  }

  if (isLoading || !creator) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const typeLabel = creator.type === 'person' ? '个人' : creator.type === 'group' ? '团体' : creator.type;

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          {creator.name}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
          {creator.type && (
            <Typography variant="body2" color="text.secondary">
              类型: {typeLabel}
            </Typography>
          )}
          {creator.platform && (
            <Chip size="small" label={creator.platform} />
          )}
          {creator.platformId && (
            <Typography variant="body2" color="text.secondary">
              平台 ID: {creator.platformId}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {creator.actor ? (
            <>
              <Typography variant="body2" color="text.secondary">
                关联演员:
              </Typography>
              <EntityPreview entityType="actor" entity={creator.actor} size="sm" />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              无关联演员
            </Typography>
          )}
          {creator.tags?.length ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                标签:
              </Typography>
              {creator.tags.map((t) => (
                <EntityPreview key={t.id} entityType="tag" entity={t} size="sm" />
              ))}
            </>
          ) : null}
        </Box>
      </Paper>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        相关视频
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}
      >
        {videos.map((v) => (
          <VideoCard key={v.id} video={v as import('../api/types').VideoDetail} />
        ))}
      </Box>
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => navigate({ search: { page: p } })}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
