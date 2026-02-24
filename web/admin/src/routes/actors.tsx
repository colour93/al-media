import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button, TextField, Autocomplete, Chip } from '@mui/material';
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
} from '../hooks/useActors';
import { getFileUrl } from '../api/file';
import { useTagsList } from '../hooks/useTags';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { renderLucideIcon } from '../utils/lucideIcons';
import { validateListSearch } from '../schemas/listSearch';
import type { Actor } from '../api/types';
import type { Tag, TagType } from '../api/types';

export const Route = createFileRoute('/actors')({
  validateSearch: validateListSearch,
  component: ActorsPage,
});

function ActorsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder, editId } = Route.useSearch();

  const { data, isLoading } = useActorsList(page, pageSize, keyword, sortBy, sortOrder);
  const { data: tagsData } = useTagsList(1, 20, '');
  const createMut = useActorCreate();
  const updateMut = useActorUpdate();
  const deleteMut = useActorDelete();



  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Actor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Actor | null>(null);
  const [formName, setFormName] = useState('');
  const [formAvatarKey, setFormAvatarKey] = useState<string | null>(null);
  const [formTagIds, setFormTagIds] = useState<number[]>([]);

  const actorIdToFetch = editing?.id ?? editId ?? null;
  const { data: actorDetail } = useActor(actorIdToFetch);

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  const tags = tagsData?.items ?? [];

  const handleOpenCreate = () => {
    setEditing(null);
    setFormName('');
    setFormAvatarKey(null);
    setFormTagIds([]);
    setFormOpen(true);
  };

  const handleOpenEdit = (row: Actor) => {
    setEditing(row);
    setFormName(row.name);
    setFormAvatarKey(row.avatarKey ?? null);
    setFormTagIds([]);
    setFormOpen(true);
  };

  useEffect(() => {
    if (actorDetail?.tags) {
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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          演员
        </Typography>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
          新建
        </Button>
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
        message={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMut.isPending}
      />
    </Box>
  );
}
