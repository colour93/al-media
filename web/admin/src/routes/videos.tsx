import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Box,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Chip,
} from '@mui/material';
import { Plus, Pencil, Trash2, Play, Tags, Sparkles } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import { FileUpload } from '../components/FileUpload/FileUpload';
import {
  useVideosList,
  useVideo,
  useVideoCreate,
  useVideoUpdate,
  useVideoDelete,
  useVideoReExtract,
} from '../hooks/useVideos';
import { batchAddTagsToVideos } from '../api/videos';
import { useActorsList, useActorCreate } from '../hooks/useActors';
import { useCreatorsList, useCreatorCreate } from '../hooks/useCreators';
import { useDistributorsList, useDistributorCreate } from '../hooks/useDistributors';
import { useTagsList } from '../hooks/useTags';
import { getFileUrl } from '../api/file';
import { renderLucideIcon } from '../utils/lucideIcons';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { EntityCreateAutocomplete } from '../components/EntityCreateAutocomplete/EntityCreateAutocomplete';
import { VideoPreviewDialog } from '../components/VideoPreviewDialog/VideoPreviewDialog';
import { validateListSearch } from '../schemas/listSearch';
import type { VideoDetail } from '../api/videos';
import type { Actor } from '../api/types';
import type { Creator } from '../api/types';
import type { Distributor } from '../api/types';
import type { Tag } from '../api/types';
import type { TagType } from '../api/types';

export const Route = createFileRoute('/videos')({
  validateSearch: validateListSearch,
  component: VideosPage,
});

function VideosPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder, editId } = Route.useSearch();

  const { data, isLoading } = useVideosList(page, pageSize, keyword, sortBy, sortOrder);
  const [editing, setEditing] = useState<VideoDetail | null>(null);
  const videoIdToFetch = editing?.id ?? editId ?? null;
  const { data: videoDetail } = useVideo(videoIdToFetch);
  const { data: actorsData } = useActorsList(1, 20, '');
  const { data: creatorsData } = useCreatorsList(1, 20, '');
  const { data: distributorsData } = useDistributorsList(1, 20, '');
  const { data: tagsData } = useTagsList(1, 20, '');
  const queryClient = useQueryClient();
  const createMut = useVideoCreate();
  const updateMut = useVideoUpdate();
  const deleteMut = useVideoDelete();
  const reExtractMut = useVideoReExtract();
  const actorCreateMut = useActorCreate();
  const creatorCreateMut = useCreatorCreate();
  const distributorCreateMut = useDistributorCreate();

  const [additionalActors, setAdditionalActors] = useState<Actor[]>([]);
  const [additionalCreators, setAdditionalCreators] = useState<Creator[]>([]);
  const [additionalDistributors, setAdditionalDistributors] = useState<Distributor[]>([]);

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {setSearchDraft(keyword)}, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VideoDetail | null>(null);
  const [previewVideoId, setPreviewVideoId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchTagsOpen, setBatchTagsOpen] = useState(false);
  const [batchTagIds, setBatchTagIds] = useState<number[]>([]);
  const [batchTagsSubmitting, setBatchTagsSubmitting] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formThumbnailKey, setFormThumbnailKey] = useState<string | null>(null);
  const [formActorIds, setFormActorIds] = useState<number[]>([]);
  const [formCreatorIds, setFormCreatorIds] = useState<number[]>([]);
  const [formDistributorIds, setFormDistributorIds] = useState<number[]>([]);
  const [formTagIds, setFormTagIds] = useState<number[]>([]);

  const actors = useMemo(() => {
    const seen = new Set<number>();
    const list = [...(actorsData?.items ?? []), ...additionalActors];
    return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  }, [actorsData?.items, additionalActors]);
  const creators = useMemo(() => {
    const seen = new Set<number>();
    const list = [...(creatorsData?.items ?? []), ...additionalCreators];
    return list.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }, [creatorsData?.items, additionalCreators]);
  const distributors = useMemo(() => {
    const seen = new Set<number>();
    const list = [...(distributorsData?.items ?? []), ...additionalDistributors];
    return list.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  }, [distributorsData?.items, additionalDistributors]);
  const tags = tagsData?.items ?? [];

  const handleOpenCreate = () => {
    setEditing(null);
    setFormTitle('');
    setFormThumbnailKey(null);
    setFormActorIds([]);
    setFormCreatorIds([]);
    setFormDistributorIds([]);
    setFormTagIds([]);
    setFormOpen(true);
  };

  const handleOpenEdit = (row: VideoDetail) => {
    setEditing(row);
    setFormTitle(row.title);
    setFormThumbnailKey(row.thumbnailKey ?? null);
    setFormActorIds(row.actors?.map((a) => a.id) ?? []);
    setFormCreatorIds(row.creators?.map((c) => c.id) ?? []);
    setFormDistributorIds(row.distributors?.map((d) => d.id) ?? []);
    setFormTagIds(row.tags?.map((t) => t.id) ?? []);
    setFormOpen(true);
  };

  useEffect(() => {
    if (videoDetail) {
      setFormActorIds(videoDetail.actors?.map((a) => a.id) ?? []);
      setFormCreatorIds(videoDetail.creators?.map((c) => c.id) ?? []);
      setFormDistributorIds(videoDetail.distributors?.map((d) => d.id) ?? []);
      setFormTagIds(videoDetail.tags?.map((t) => t.id) ?? []);
    }
  }, [videoDetail]);

  useEffect(() => {
    if (editId && videoDetail) {
      setEditing(videoDetail);
      setFormTitle(videoDetail.title);
      setFormThumbnailKey(videoDetail.thumbnailKey ?? null);
      setFormOpen(true);
    }
  }, [editId, videoDetail]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    setAdditionalDistributors([]);
    if (editId) navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
  };

  const handleFormSubmit = async () => {
    const payload = {
      title: formTitle,
      thumbnailKey: formThumbnailKey ?? undefined,
      actors: formActorIds.length ? formActorIds : undefined,
      creators: formCreatorIds.length ? formCreatorIds : undefined,
      distributors: formDistributorIds.length ? formDistributorIds : undefined,
      tags: formTagIds.length ? formTagIds : undefined,
    };
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    handleFormClose();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((r) => r.id)));
    }
  };

  const handleBatchAddTags = async () => {
    if (selectedIds.size === 0 || batchTagIds.length === 0) return;
    setBatchTagsSubmitting(true);
    try {
      await batchAddTagsToVideos(Array.from(selectedIds), batchTagIds);
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      setBatchTagsOpen(false);
      setBatchTagIds([]);
      setSelectedIds(new Set());
    } finally {
      setBatchTagsSubmitting(false);
    }
  };


  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: DataTableColumn<VideoDetail>[] = [
    {
      id: '_select',
      label: (
        <Checkbox
          size="small"
          checked={items.length > 0 && selectedIds.size === items.length}
          indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
          onChange={toggleSelectAll}
        />
      ),
      width: 48,
      align: 'center',
      render: (r) => (
        <Checkbox
          size="small"
          checked={selectedIds.has(r.id)}
          onChange={() => toggleSelect(r.id)}
        />
      ),
    },
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id, sortable: true, sortKey: 'id' },
    {
      id: 'thumb',
      label: '缩略图',
      width: 60,
      render: (r) =>
        r.thumbnailKey ? (
          <Box
            component="img"
            src={getFileUrl('thumbnails', r.thumbnailKey)}
            alt=""
            sx={{ width: 48, height: 36, borderRadius: 1, objectFit: 'cover' }}
          />
        ) : (
          '-'
        ),
    },
    { id: 'title', label: '标题', render: (r) => r.title, sortable: true, sortKey: 'title' },
    {
      id: 'actors',
      label: '演员',
      render: (r) =>
        r.actors?.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {r.actors.map((a) => (
              <EntityPreview key={a.id} entityType="actor" entity={a as Actor} />
            ))}
          </Box>
        ) : (
          '-'
        ),
    },
    {
      id: 'creators',
      label: '创作者',
      render: (r) =>
        r.creators?.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {r.creators.map((c) => (
              <EntityPreview key={c.id} entityType="creator" entity={c as Creator} />
            ))}
          </Box>
        ) : (
          '-'
        ),
    },
    {
      id: 'distributors',
      label: '发行方',
      render: (r) =>
        r.distributors?.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {r.distributors.map((d) => (
              <EntityPreview key={d.id} entityType="distributor" entity={d as Distributor} />
            ))}
          </Box>
        ) : (
          '-'
        ),
    },
    {
      id: 'tags',
      label: '标签',
      render: (r) =>
        r.tags?.length ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {r.tags.map((t) => (
              <EntityPreview key={t.id} entityType="tag" entity={t as Tag} />
            ))}
          </Box>
        ) : (
          '-'
        ),
    },
  ];

  const selectedActors = actors.filter((a) => formActorIds.includes(a.id));
  const selectedCreators = creators.filter((c) => formCreatorIds.includes(c.id));
  const selectedDistributors = distributors.filter((d) => formDistributorIds.includes(d.id));
  const selectedTags = tags.filter((t) => formTagIds.includes(t.id));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          视频
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Tags size={18} />}
            disabled={selectedIds.size === 0}
            onClick={() => setBatchTagsOpen(true)}
          >
            批量添加标签 ({selectedIds.size})
          </Button>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
            新建
          </Button>
        </Box>
      </Box>

      <DataTable<VideoDetail>
        tableId="videos"
        columns={columns}
        rows={items}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })}
        onPageSizeChange={(ps) =>
          navigate({ search: (prev) => ({ ...prev, pageSize: ps, page: 1 }) })
        }
        loading={isLoading}
        searchPlaceholder="搜索视频…"
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearch={(k) => navigate({ search: (prev) => ({ ...prev, keyword: k, page: 1 }) })}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(by, order) =>
          navigate({ search: (prev) => ({ ...prev, sortBy: by, sortOrder: order, page: 1 }) })
        }
        actions={(row) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              startIcon={<Play size={14} />}
              onClick={() => setPreviewVideoId(row.id)}
            >
              预览
            </Button>
            <Button size="small" startIcon={<Pencil size={14} />} onClick={() => handleOpenEdit(row)}>
              编辑
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<Trash2 size={14} />}
              onClick={() => setDeleteTarget(row)}
            >
              删除
            </Button>
          </Box>
        )}
        emptyMessage="暂无视频"
      />

      <FormDialog
        open={formOpen}
        title={editing ? '编辑视频' : '新建视频'}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        loading={createMut.isPending || updateMut.isPending}
        maxWidth="md"
        actionsBefore={editing ? (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Sparkles size={14} />}
            onClick={async () => {
              try {
                const updated = await reExtractMut.mutateAsync(editing.id);
                if (updated) {
                  queryClient.invalidateQueries({ queryKey: ['videos', 'detail', editing.id] });
                  setFormTitle(updated.title ?? formTitle);
                  setFormThumbnailKey(updated.thumbnailKey ?? formThumbnailKey);
                  setFormActorIds(updated.actors?.map((a) => a.id) ?? formActorIds);
                  setFormCreatorIds(updated.creators?.map((c) => c.id) ?? formCreatorIds);
                  setFormDistributorIds(updated.distributors?.map((d) => d.id) ?? formDistributorIds);
                  setFormTagIds(updated.tags?.map((t) => t.id) ?? formTagIds);
                }
              } catch {
                /* 错误已由 mutation onError 处理 */
              }
            }}
            disabled={reExtractMut.isPending}
          >
            重新推断
          </Button>
        ) : null}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="标题"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              缩略图
            </Typography>
            <FileUpload
              category="thumbnails"
              value={formThumbnailKey}
              onChange={setFormThumbnailKey}
              previewSize={120}
            />
          </Box>
          <EntityCreateAutocomplete<Actor>
            label="演员"
            placeholder="选择或输入新建"
            options={actors}
            value={selectedActors}
            onChange={setFormActorIds}
            getOptionLabel={(a) => a.name}
            renderOption={(_, a) => (
              <EntityPreview entityType="actor" entity={a} inline />
            )}
            renderTags={(value, getTagProps) =>
              value.map((a, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={a.id}
                  size="small"
                  avatar={
                    a.avatarKey ? (
                      <Avatar src={getFileUrl('avatars', a.avatarKey)} alt="" />
                    ) : undefined
                  }
                  label={a.name}
                />
              ))
            }
            onCreate={async (name) => actorCreateMut.mutateAsync({ name })}
            onCreated={(entity) => setAdditionalActors((prev) => [...prev, entity])}
          />
          <EntityCreateAutocomplete<Creator>
            label="创作者"
            placeholder="选择或输入新建"
            options={creators}
            value={selectedCreators}
            onChange={setFormCreatorIds}
            getOptionLabel={(c) => c.name}
            renderOption={(_, c) => (
              <EntityPreview entityType="creator" entity={c} inline />
            )}
            renderTags={(value, getTagProps) =>
              value.map((c, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={c.id}
                  size="small"
                  label={c.platform ? `${c.name} (${c.platform})` : c.name}
                />
              ))
            }
            onCreate={async (name) => creatorCreateMut.mutateAsync({ name, type: 'person' })}
            onCreated={(entity) => setAdditionalCreators((prev) => [...prev, entity])}
          />
          <EntityCreateAutocomplete<Distributor>
            label="发行方"
            placeholder="选择或输入新建"
            options={distributors}
            value={selectedDistributors}
            onChange={setFormDistributorIds}
            getOptionLabel={(d) => d.name}
            renderOption={(_, d) => (
              <EntityPreview entityType="distributor" entity={d} inline />
            )}
            renderTags={(value, getTagProps) =>
              value.map((d, index) => (
                <Chip {...getTagProps({ index })} key={d.id} size="small" label={d.name} />
              ))
            }
            onCreate={async (name) => distributorCreateMut.mutateAsync({ name })}
            onCreated={(entity) => setAdditionalDistributors((prev) => [...prev, entity])}
          />
          <Autocomplete<Tag, true>
            multiple
            options={tags}
            getOptionLabel={(t) => t.name}
            value={selectedTags}
            onChange={(_, v) => setFormTagIds(v.map((t) => t.id))}
            renderOption={(props, t) => (
              <li {...props} key={t.id}>
                <EntityPreview
                  entityType="tag"
                  entity={t as Tag & { tagType?: TagType }}
                  inline
                />
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((t, index) => {
                const tagWithType = t as Tag & { tagType?: TagType };
                const iconEl = tagWithType.tagType?.icon
                  ? renderLucideIcon(tagWithType.tagType.icon, { size: 12 })
                  : null;
                const label =
                  tagWithType.tagType?.name
                    ? `${tagWithType.tagType.name}: ${t.name}`
                    : t.name;
                return (
                  <Chip
                    {...getTagProps({ index })}
                    key={t.id}
                    size="small"
                    icon={iconEl ? (iconEl as React.ReactElement) : undefined}
                    label={label}
                    sx={{
                      bgcolor: t.color ?? 'action.selected',
                      '& .MuiChip-label': { color: t.color ? 'rgba(0,0,0,0.7)' : 'inherit' },
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField {...params} label="标签" placeholder="选择标签" />
            )}
          />
        </Box>
      </FormDialog>

      <DeleteConfirm
        open={!!deleteTarget}
        message={deleteTarget ? `确定要删除「${deleteTarget.title}」吗？` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMut.isPending}
      />

      <VideoPreviewDialog
        open={!!previewVideoId}
        onClose={() => setPreviewVideoId(null)}
        videoId={previewVideoId}
      />

      <Dialog open={batchTagsOpen} onClose={() => setBatchTagsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>批量添加标签</DialogTitle>
        <DialogContent>
          <Autocomplete<Tag, true>
            multiple
            options={tags}
            getOptionLabel={(t) => t.name}
            value={tags.filter((t) => batchTagIds.includes(t.id))}
            onChange={(_, v) => setBatchTagIds(v.map((t) => t.id))}
            renderOption={(props, t) => (
              <li {...props} key={t.id}>
                <EntityPreview
                  entityType="tag"
                  entity={t as Tag & { tagType?: TagType }}
                  inline
                />
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((t, index) => {
                const tagWithType = t as Tag & { tagType?: TagType };
                const iconEl = tagWithType.tagType?.icon
                  ? renderLucideIcon(tagWithType.tagType.icon, { size: 12 })
                  : null;
                const label =
                  tagWithType.tagType?.name
                    ? `${tagWithType.tagType.name}: ${t.name}`
                    : t.name;
                return (
                  <Chip
                    {...getTagProps({ index })}
                    key={t.id}
                    size="small"
                    icon={iconEl ? (iconEl as React.ReactElement) : undefined}
                    label={label}
                    sx={{
                      bgcolor: t.color ?? 'action.selected',
                      '& .MuiChip-label': { color: t.color ? 'rgba(0,0,0,0.7)' : 'inherit' },
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField {...params} label="选择标签" placeholder="选择要添加的标签" />
            )}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchTagsOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleBatchAddTags}
            disabled={batchTagIds.length === 0 || batchTagsSubmitting}
          >
            {batchTagsSubmitting ? '处理中…' : '确定'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
