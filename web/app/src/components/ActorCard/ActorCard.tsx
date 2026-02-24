import { Card, CardActionArea, CardContent, Box, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { getFileUrl } from '../../api/file';
import { EntityPreview } from '../EntityPreview/EntityPreview';
import type { Actor } from '../../api/types';

interface ActorCardProps {
  actor: Actor & { tags?: import('../../api/types').Tag[] };
}

export function ActorCard({ actor }: ActorCardProps) {
  return (
    <Card
      component={Link}
      to="/actors/$id"
      params={{ id: String(actor.id) }}
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
          {actor.avatarKey ? (
            <Box
              component="img"
              src={getFileUrl('avatars', actor.avatarKey)}
              alt={actor.name}
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                objectFit: 'cover',
                bgcolor: 'action.selected',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'action.selected',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h6" color="text.secondary">
                ?
              </Typography>
            </Box>
          )}
          <Typography variant="body2" fontWeight={500} textAlign="center" sx={{ maxWidth: '100%' }} noWrap title={actor.name}>
            {actor.name}
          </Typography>
          {actor.tags?.length ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
              {actor.tags.map((t) => (
                <EntityPreview key={t.id} entityType="tag" entity={t} size="sm" />
              ))}
            </Box>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
