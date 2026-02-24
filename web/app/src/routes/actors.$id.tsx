import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Pagination,
} from '@mui/material';
import { getFileUrl } from '../api/file';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { CreatorCard } from '../components/CreatorCard/CreatorCard';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { useActor, useActorCreators, useActorVideos } from '../hooks/useEntities';

export const Route = createFileRoute('/actors/$id')({
  validateSearch: (s: Record<string, unknown>) => ({
    page: Number(s?.page) || 1,
  }),
  component: ActorDetailPage,
});

function ActorDetailPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { id } = Route.useParams();
  const { page } = Route.useSearch();
  const actorId = Number(id);
  const pageSize = 12;

  const { data: actor, isLoading } = useActor(Number.isInteger(actorId) ? actorId : null);
  const { data: creators } = useActorCreators(Number.isInteger(actorId) ? actorId : null);
  const { data: videosData } = useActorVideos(
    Number.isInteger(actorId) ? actorId : null,
    page,
    pageSize
  );

  const videos = videosData?.items ?? [];
  const total = videosData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (!Number.isInteger(actorId)) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">演员不存在</Typography>
      </Box>
    );
  }

  if (isLoading || !actor) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {actor.avatarKey ? (
            <Box
              component="img"
              src={getFileUrl('avatars', actor.avatarKey)}
              alt={actor.name}
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                objectFit: 'cover',
                bgcolor: 'action.selected',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'action.selected',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h4" color="text.secondary">
                ?
              </Typography>
            </Box>
          )}
          <Box>
            <Typography variant="h5" fontWeight={600}>
              {actor.name}
            </Typography>
            {actor.tags?.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {actor.tags.map((t) => (
                  <EntityPreview key={t.id} entityType="tag" entity={t} size="sm" />
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      </Paper>
      {(creators?.length ?? 0) > 0 ? (
        <>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            关联创作者
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
              mb: 3,
            }}
          >
            {creators!.map((c) => (
              <CreatorCard key={c.id} creator={c as Parameters<typeof CreatorCard>[0]['creator']} />
            ))}
          </Box>
        </>
      ) : null}
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
