import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button, TextField, Chip } from '@mui/material';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import { FileUpload } from '../components/FileUpload/FileUpload';
import {
  useActorsList,
  useActor,
  useActorCreate,
  useActorUpdate,
  useActorDelete,
  useActorMerge,
} from '../hooks/useActors';
import { getFileUrl } from '../api/file';
import { useTagsList } from '../hooks/useTags';
import { fetchTagsList, searchTags } from '../api/tags';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { EntityCreateAutocomplete } from '../components/EntityCreateAutocomplete/EntityCreateAutocomplete';
import { renderLucideIcon } from '../utils/lucideIcons';
import { validateListSearch } from '../schemas/listSearch';
import type { Actor } from '../api/types';
import type { Tag, TagType } from '../api/types';

export const Route = createFileRoute('/actors')({
  validateSearch: validateListSearch,
  component: ActorsPage,
});

const ENTITY_SELECTOR_PAGE_SIZE = 20;

function mergeById<T extends { id: number }>(base: T[], extra: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of [...base, ...extra]) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function parseIdList(value: string): number[] {
  return [...new Set(
    value
      .split(/[,\s，]+/)
      .map((it) => Number(it.trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function ActorsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder, editId } = Route.useSearch();

  const { data, isLoading } = useActorsList(page, pageSize, keyword, sortBy, sortOrder);
  const { data: tagsData } = useTagsList(1, 20, '');
  const createMut = useActorCreate();
  const updateMut = useActorUpdate();
  const deleteMut = useActorDelete();
  const mergeMut = useActorMerge();



  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Actor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Actor | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetIdInput, setMergeTargetIdInput] = useState('');
  const [mergeSourceIdsInput, setMergeSourceIdsInput] = useState('');
  const [formName, setFormName] = useState('');
  const [formAvatarKey, setFormAvatarKey] = useState<string | null>(null);
  const [formTagIds, setFormTagIds] = useState<number[]>([]);
  const [additionalTags, setAdditionalTags] = useState<(Tag & { tagType?: TagType })[]>([]);

  const actorIdToFetch = editing?.id ?? editId ?? null;
  const { data: actorDetail } = useActor(actorIdToFetch);

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  const tags = useMemo(
    () =>
      mergeById(
        (tagsData?.items ?? []) as (Tag & { tagType?: TagType })[],
        additionalTags
      ),
    [tagsData?.items, additionalTags]
  );

  const handleOpenCreate = () => {
    setEditing(null);
    setFormName('');
    setFormAvatarKey(null);
    setFormTagIds([]);
    setAdditionalTags([]);
    setFormOpen(true);
  };

  const handleOpenEdit = (row: Actor) => {
    setEditing(row);
    setFormName(row.name);
    setFormAvatarKey(row.avatarKey ?? null);
    setFormTagIds([]);
    setAdditionalTags((row.tags ?? []) as (Tag & { tagType?: TagType })[]);
    setFormOpen(true);
  };

  useEffect(() => {
    if (actorDetail?.tags) {
      setAdditionalTags((prev) =>
        mergeById(prev, actorDetail.tags as (Tag & { tagType?: TagType })[])
      );
      setFormTagIds(actorDetail.tags.map((t) => t.id));
    }
  }, [actorDetail?.tags]);

  useEffect(() => {
    if (editId && actorDetail) {
      setEditing(actorDetail);
      setFormName(actorDetail.name);
      setFormAvatarKey(actorDetail.avatarKey ?? null);
      setFormOpen(true);
    }
  }, [editId, actorDetail]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    setAdditionalTags([]);
    if (editId) {
      navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
    }
  };

  const handleFormSubmit = async () => {
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id,
        data: {
          name: formName,
          avatarKey: formAvatarKey ?? undefined,
          tags: formTagIds,
        },
      });
    } else {
      await createMut.mutateAsync({
        name: formName,
        avatarKey: formAvatarKey ?? undefined,
        tags: formTagIds.length ? formTagIds : undefined,
      });
    }
    handleFormClose();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const columns: DataTableColumn<Actor>[] = [
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id, sortable: true, sortKey: 'id' },
    {
      id: 'avatar',
      label: '头像',
      width: 60,
      render: (r) =>
        r.avatarKey ? (
          <Box
            component="img"
            src={getFileUrl('avatars', r.avatarKey)}
            alt=""
            sx={{ width: 36, height: 36, borderRadius: 1, objectFit: 'cover' }}
          />
        ) : (
          '-'
        ),
    },
    { id: 'name', label: '名称', render: (r) => r.name, sortable: true, sortKey: 'name' },
    {
      id: 'tags',
      label: '标签',
      render: () => '-',
    },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const selectedTags = tags.filter((t) => formTagIds.includes(t.id));
  const mergeTargetId = Number(mergeTargetIdInput);
  const mergeSourceIds = useMemo(() => parseIdList(mergeSourceIdsInput), [mergeSourceIdsInput]);
  const mergeValid =
    Number.isInteger(mergeTargetId) &&
    mergeTargetId > 0 &&
    mergeSourceIds.length > 0 &&
    !mergeSourceIds.includes(mergeTargetId);

  const handleMergeSubmit = async () => {
    if (!mergeValid) return;
    await mergeMut.mutateAsync({ targetId: mergeTargetId, sourceIds: mergeSourceIds });
    setMergeOpen(false);
    setMergeTargetIdInput('');
    setMergeSourceIdsInput('');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          演员
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setMergeTargetIdInput('');
              setMergeSourceIdsInput('');
              setMergeOpen(true);
            }}
          >
            快速合并
          </Button>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
            新建
          </Button>
        </Box>
      </Box>

      <DataTable<Actor>
        tableId="actors"
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
        searchPlaceholder="搜索演员…"
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
        emptyMessage="暂无演员"
      />

      <FormDialog
        open={formOpen}
        title={editing ? '编辑演员' : '新建演员'}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        loading={createMut.isPending || updateMut.isPending}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="名称"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              头像
            </Typography>
            <FileUpload
              category="avatars"
              value={formAvatarKey}
              onChange={setFormAvatarKey}
            />
          </Box>
          <EntityCreateAutocomplete<Tag & { tagType?: TagType }>
            label="标签"
            placeholder="搜索并选择标签"
            options={tags}
            value={selectedTags as (Tag & { tagType?: TagType })[]}
            onChange={setFormTagIds}
            pageSize={ENTITY_SELECTOR_PAGE_SIZE}
            loadOptions={({ keyword, page, pageSize }) =>
              keyword.trim()
                ? searchTags(keyword.trim(), page, pageSize)
                : fetchTagsList(page, pageSize)
            }
            getOptionLabel={(t) => t.name}
            renderOption={(_, t) => (
              <EntityPreview
                entityType="tag"
                entity={t as Tag & { tagType?: TagType }}
                inline
              />
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
          />
        </Box>
      </FormDialog>

      <FormDialog
        open={mergeOpen}
        title="快速合并演员"
        onClose={() => setMergeOpen(false)}
        onSubmit={handleMergeSubmit}
        loading={mergeMut.isPending}
        submitDisabled={!mergeValid}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="目标演员 ID"
            value={mergeTargetIdInput}
            onChange={(e) => setMergeTargetIdInput(e.target.value)}
            required
            fullWidth
            placeholder="例如 101"
          />
          <TextField
            label="待合并 ID（逗号/空格分隔）"
            value={mergeSourceIdsInput}
            onChange={(e) => setMergeSourceIdsInput(e.target.value)}
            required
            fullWidth
            placeholder="例如 102,103,104"
            helperText="会将待合并演员的视频关联、标签、创作者关联迁移到目标 ID"
          />
        </Box>
      </FormDialog>

      <DeleteConfirm
        open={!!deleteTarget}
        message={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMut.isPending}
      />
    </Box>
  );
}

