import { Card, CardActionArea, CardContent, Box, Typography, Chip } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { EntityPreview } from '../EntityPreview/EntityPreview';
import type { Creator } from '../../api/types';

interface CreatorCardProps {
  creator: Creator & { actor?: import('../../api/types').Actor | null; tags?: import('../../api/types').Tag[] };
}

const TYPE_LABELS: Record<string, string> = {
  person: '个人',
  group: '团体',
};

export function CreatorCard({ creator }: CreatorCardProps) {
  return (
    <Card
      component={Link}
      to="/creators/$id"
      params={{ id: String(creator.id) }}
      preload="intent"
      sx={{
        height: '100%',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      }}
    >
      <CardActionArea sx={{ height: '100%' }}>
        <CardContent sx={{ py: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1" fontWeight={600} textAlign="center" noWrap title={creator.name} sx={{ maxWidth: '100%' }}>
            {creator.name}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
            {creator.type && (
              <Chip size="small" label={TYPE_LABELS[creator.type] ?? creator.type} variant="outlined" />
            )}
            {creator.platform && (
              <Chip size="small" label={creator.platform} variant="outlined" />
            )}
            {creator.platformId && (
              <Typography variant="caption" color="text.secondary">
                ID: {creator.platformId}
              </Typography>
            )}
          </Box>
          {creator.actor && (
            <EntityPreview entityType="actor" entity={creator.actor} size="sm" disableLink />
          )}
          {creator.tags?.length ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
              {creator.tags.map((t) => (
                <EntityPreview key={t.id} entityType="tag" entity={t} size="sm" disableLink />
              ))}
            </Box>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
