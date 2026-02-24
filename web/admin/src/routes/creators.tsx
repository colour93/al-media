import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button, TextField, MenuItem, Autocomplete, Chip } from '@mui/material';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import {
  useCreatorsList,
  useCreatorCreate,
  useCreatorUpdate,
  useCreatorDelete,
  useCreator,
} from '../hooks/useCreators';
import { useActorsList } from '../hooks/useActors';
import { useTagsList } from '../hooks/useTags';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { renderLucideIcon } from '../utils/lucideIcons';
import { validateListSearch } from '../schemas/listSearch';
import type { Creator } from '../api/types';
import type { Tag, TagType } from '../api/types';

const CREATOR_TYPES = [
  { value: 'person' as const, label: '个人' },
  { value: 'group' as const, label: '团体' },
];

const PLATFORMS = [
  { value: 'onlyfans' as const, label: 'OnlyFans' },
  { value: 'justforfans' as const, label: 'JustForFans' },
  { value: 'fansone' as const, label: 'FansOne' },
  { value: 'fansonly' as const, label: 'FansOnly' },
];

export const Route = createFileRoute('/creators')({
  validateSearch: validateListSearch,
  component: CreatorsPage,
});

function CreatorsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder, editId } = Route.useSearch();

  const { data, isLoading } = useCreatorsList(page, pageSize, keyword, sortBy, sortOrder);
  const [editing, setEditing] = useState<Creator | null>(null);
  const creatorIdToFetch = editing?.id ?? editId ?? null;
  const { data: creatorDetail } = useCreator(creatorIdToFetch);
  const { data: actorsData } = useActorsList(1, 20, '');
  const { data: tagsData } = useTagsList(1, 20, '');
  const createMut = useCreatorCreate();
  const updateMut = useCreatorUpdate();
  const deleteMut = useCreatorDelete();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {setSearchDraft(keyword)}, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Creator | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'person' | 'group'>('person');
  const [formActorId, setFormActorId] = useState<number | ''>('');
  const [formPlatform, setFormPlatform] = useState<string | ''>('');
  const [formPlatformId, setFormPlatformId] = useState('');
  const [formTagIds, setFormTagIds] = useState<number[]>([]);

  const actors = actorsData?.items ?? [];
  const tags = tagsData?.items ?? [];

  const handleOpenCreate = () => {
    setEditing(null);
    setFormName('');
    setFormType('person');
    setFormActorId('');
    setFormPlatform('');
    setFormPlatformId('');
    setFormTagIds([]);
    setFormOpen(true);
  };

  const handleOpenEdit = (row: Creator) => {
    setEditing(row);
    setFormName(row.name);
    setFormType(row.type);
    setFormActorId(row.actorId ?? '');
    setFormPlatform(row.platform ?? '');
    setFormPlatformId(row.platformId ?? '');
    setFormTagIds([]);
    setFormOpen(true);
  };

  useEffect(() => {
    if (creatorDetail?.tags) {
      setFormTagIds(creatorDetail.tags.map((t) => t.id));
    }
  }, [creatorDetail?.tags]);

  useEffect(() => {
    if (editId && creatorDetail) {
      setEditing(creatorDetail);
      setFormName(creatorDetail.name);
      setFormType(creatorDetail.type);
      setFormActorId(creatorDetail.actorId ?? '');
      setFormPlatform(creatorDetail.platform ?? '');
      setFormPlatformId(creatorDetail.platformId ?? '');
      setFormOpen(true);
    }
  }, [editId, creatorDetail]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    if (editId) navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
  };

  const handleFormSubmit = async () => {
    const payload = {
      name: formName,
      type: formType,
      actorId: formActorId === '' ? null : formActorId,
      platform: formPlatform === '' ? null : (formPlatform as 'onlyfans' | 'justforfans' | 'fansone' | 'fansonly'),
      platformId: formPlatformId || null,
      tags: formTagIds,
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

  const columns: DataTableColumn<Creator>[] = [
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id, sortable: true, sortKey: 'id' },
    { id: 'name', label: '名称', render: (r) => r.name, sortable: true, sortKey: 'name' },
    {
      id: 'type',
      label: '类型',
      width: 80,
      render: (r) => (r.type === 'person' ? '个人' : '团体'),
      sortable: true,
      sortKey: 'type',
    },
    { id: 'platform', label: '平台', render: (r) => r.platform ?? '-' },
    { id: 'platformId', label: '平台ID', render: (r) => r.platformId ?? '-' },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const selectedTags = tags.filter((t) => formTagIds.includes(t.id));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          创作者
        </Typography>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
          新建
        </Button>
      </Box>

      <DataTable<Creator>
        tableId="creators"
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
        searchPlaceholder="搜索创作者…"
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
        emptyMessage="暂无创作者"
      />

      <FormDialog
        open={formOpen}
        title={editing ? '编辑创作者' : '新建创作者'}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        loading={createMut.isPending || updateMut.isPending}
        maxWidth="sm"
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
          <TextField
            select
            label="类型"
            value={formType}
            onChange={(e) => setFormType(e.target.value as 'person' | 'group')}
            fullWidth
          >
            {CREATOR_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="关联演员"
            value={formActorId}
            onChange={(e) => setFormActorId(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
          >
            <MenuItem value="">无</MenuItem>
            {actors.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="平台"
            value={formPlatform}
            onChange={(e) => setFormPlatform(e.target.value)}
            fullWidth
          >
            <MenuItem value="">无</MenuItem>
            {PLATFORMS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="平台ID"
            value={formPlatformId}
            onChange={(e) => setFormPlatformId(e.target.value)}
            placeholder="可选"
            fullWidth
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
        message={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMut.isPending}
      />
    </Box>
  );
}
