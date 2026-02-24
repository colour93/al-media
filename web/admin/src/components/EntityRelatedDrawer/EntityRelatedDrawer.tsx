import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  CircularProgress,
  Tabs,
  Tab,
  TablePagination,
} from '@mui/material';
import { X } from 'lucide-react';
import { EntityPreview } from '../EntityPreview/EntityPreview';
import { fetchActorVideos } from '../../api/actors';
import { fetchCreatorVideos } from '../../api/creators';
import { fetchTagRelated } from '../../api/tags';
import type { TagRelatedCategory } from '../../api/tags';
import type { Actor, Creator, Tag, Video } from '../../api/types';

export type EntityRelatedDrawerEntityType = 'actor' | 'creator' | 'tag';

export interface EntityRelatedDrawerProps {
  entityType: EntityRelatedDrawerEntityType;
  entity: Actor | Creator | Tag;
  open: boolean;
  onClose: () => void;
}

type RelatedItem = Actor | Creator | Video;

export function EntityRelatedDrawer({
  entityType,
  entity,
  open,
  onClose,
}: EntityRelatedDrawerProps) {
  const [items, setItems] = useState<RelatedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [tagCategory, setTagCategory] = useState<TagRelatedCategory | null>(null);

  const title =
    entityType === 'actor'
      ? `演员「${(entity as Actor).name}」关联视频`
      : entityType === 'creator'
        ? `创作者「${(entity as Creator).name}」关联视频`
        : `标签「${(entity as Tag).name}」关联内容`;

  useEffect(() => {
    if (!open || !entity) return;
    setPage(1);
    if (entityType === 'tag') {
      setTagCategory(null);
    }
  }, [open, entity, entityType]);

  useEffect(() => {
    if (!open || !entity) return;

    if (entityType === 'tag' && !tagCategory) {
      setItems([]);
      setTotal(0);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        if (entityType === 'actor') {
          const res = await fetchActorVideos((entity as Actor).id, page, pageSize);
          setItems((res.items as Video[]) ?? []);
          setTotal(res.total ?? 0);
        } else if (entityType === 'creator') {
          const res = await fetchCreatorVideos((entity as Creator).id, page, pageSize);
          setItems((res.items as Video[]) ?? []);
          setTotal(res.total ?? 0);
        } else if (entityType === 'tag' && tagCategory) {
          const res = await fetchTagRelated<RelatedItem>(
            (entity as Tag).id,
            tagCategory,
            page,
            pageSize
          );
          setItems(res.items ?? []);
          setTotal(res.total ?? 0);
        }
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, entity, entityType, tagCategory, page, pageSize]);

  const renderItem = (item: RelatedItem) => {
    if (entityType === 'tag') {
      if (tagCategory === 'video') {
        return <EntityPreview entityType="video" entity={item as Video} />;
      }
      if (tagCategory === 'actor') {
        return <EntityPreview entityType="actor" entity={item as Actor} />;
      }
      if (tagCategory === 'creator') {
        return <EntityPreview entityType="creator" entity={item as Creator} />;
      }
    }
    return <EntityPreview entityType="video" entity={item as Video} />;
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ backdrop: { invisible: false } }}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 } },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" noWrap sx={{ flex: 1, pr: 1 }}>
            {title}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <X size={20} />
          </IconButton>
        </Box>

        {entityType === 'tag' && (
          <Tabs
            value={tagCategory ?? false}
            onChange={(_, v: TagRelatedCategory) => {
              setTagCategory(v);
              setPage(1);
            }}
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
          >
            <Tab label="视频" value="video" sx={{ minHeight: 40, py: 1 }} />
            <Tab label="演员" value="actor" sx={{ minHeight: 40, py: 1 }} />
            <Tab label="创作者" value="creator" sx={{ minHeight: 40, py: 1 }} />
          </Tabs>
        )}

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {entityType === 'tag' && !tagCategory ? (
            <Typography color="text.secondary" sx={{ py: 4 }}>
              请选择分类
            </Typography>
          ) : loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : items.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4 }}>
              暂无关联内容
            </Typography>
          ) : (
            <List dense disablePadding>
              {items.map((item) => (
                <ListItem key={(item as { id?: number }).id} disablePadding sx={{ py: 0.5 }}>
                  {renderItem(item)}
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {items.length > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={(_, p) => setPage(p + 1)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="每页"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        )}
      </Box>
    </Drawer>
  );
}
