import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Pagination,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { ActorCard } from '../components/ActorCard/ActorCard';
import { CreatorCard } from '../components/CreatorCard/CreatorCard';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { useTag, useTagRelated } from '../hooks/useEntities';
import type { TagRelatedCategory } from '../api/entities';

export const Route = createFileRoute('/tags/$id')({
  validateSearch: (s: Record<string, unknown>) => ({
    category: (s?.category as TagRelatedCategory) || 'video',
    page: Number(s?.page) || 1,
  }),
  component: TagDetailPage,
});

const CATEGORY_OPTIONS: { value: TagRelatedCategory; label: string }[] = [
  { value: 'video', label: '视频' },
  { value: 'actor', label: '演员' },
  { value: 'creator', label: '创作者' },
];

function TagDetailPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { id } = Route.useParams();
  const { category, page } = Route.useSearch();
  const tagId = Number(id);
  const pageSize = 12;

  const { data: tag, isLoading } = useTag(Number.isInteger(tagId) ? tagId : null);
  const { data: relatedData } = useTagRelated(
    Number.isInteger(tagId) ? tagId : null,
    category,
    page,
    pageSize
  );

  const related = relatedData?.items ?? [];
  const total = relatedData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (!Number.isInteger(tagId)) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">标签不存在</Typography>
      </Box>
    );
  }

  if (isLoading || !tag) {
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
          <EntityPreview entityType="tag" entity={tag} size="md" />
          {tag.tagType?.name && (
            <Typography variant="body2" color="text.secondary">
              类型: {tag.tagType.name}
            </Typography>
          )}
        </Box>
      </Paper>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          按类别查看:
        </Typography>
        <ToggleButtonGroup
          value={category}
          exclusive
          onChange={(_, v) => v && navigate({ search: { category: v, page: 1 } })}
          size="small"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        相关{category === 'video' ? '视频' : category === 'actor' ? '演员' : '创作者'}
      </Typography>
      {category === 'video' ? (
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
          {related.map((v) => (
            <VideoCard key={v.id} video={v as import('../api/types').VideoDetail} />
          ))}
        </Box>
      ) : category === 'actor' ? (
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
          {related.map((item) => (
            <ActorCard key={item.id} actor={item as Parameters<typeof ActorCard>[0]['actor']} />
          ))}
        </Box>
      ) : (
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
          {related.map((item) => (
            <CreatorCard key={item.id} creator={item as Parameters<typeof CreatorCard>[0]['creator']} />
          ))}
        </Box>
      )}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => navigate({ search: { category, page: p } })}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
