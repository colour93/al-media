import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button, TextField, MenuItem, Chip } from '@mui/material';
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
  useCreatorMerge,
} from '../hooks/useCreators';
import { useActor, useActorCreate, useActorsList } from '../hooks/useActors';
import { useTagsList } from '../hooks/useTags';
import { fetchActorsList, searchActors } from '../api/actors';
import { fetchTagsList, searchTags } from '../api/tags';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { renderLucideIcon } from '../utils/lucideIcons';
import { EntityCreateAutocomplete } from '../components/EntityCreateAutocomplete/EntityCreateAutocomplete';
import { EntityCreateSingleAutocomplete } from '../components/EntityCreateAutocomplete/EntityCreateSingleAutocomplete';
import { validateListSearch } from '../schemas/listSearch';
import type { Actor, Creator } from '../api/types';
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
  const mergeMut = useCreatorMerge();
  const actorCreateMut = useActorCreate();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {setSearchDraft(keyword)}, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Creator | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetIdInput, setMergeTargetIdInput] = useState('');
  const [mergeSourceIdsInput, setMergeSourceIdsInput] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'person' | 'group'>('person');
  const [formActorId, setFormActorId] = useState<number | ''>('');
  const [formPlatform, setFormPlatform] = useState<string | ''>('');
  const [formPlatformId, setFormPlatformId] = useState('');
  const [formTagIds, setFormTagIds] = useState<number[]>([]);
  const [additionalActors, setAdditionalActors] = useState<Actor[]>([]);
  const [additionalTags, setAdditionalTags] = useState<(Tag & { tagType?: TagType })[]>([]);
  const { data: selectedActorDetail } = useActor(typeof formActorId === 'number' ? formActorId : null);

  const actors = useMemo(
    () => mergeById((actorsData?.items ?? []) as Actor[], additionalActors),
    [actorsData?.items, additionalActors]
  );
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
    setFormType('person');
    setFormActorId('');
    setFormPlatform('');
    setFormPlatformId('');
    setFormTagIds([]);
    setAdditionalActors([]);
    setAdditionalTags([]);
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
    setAdditionalTags((row.tags ?? []) as (Tag & { tagType?: TagType })[]);
    setFormOpen(true);
  };

  useEffect(() => {
    if (creatorDetail?.tags) {
      setAdditionalTags((prev) =>
        mergeById(prev, creatorDetail.tags as (Tag & { tagType?: TagType })[])
      );
      setFormTagIds(creatorDetail.tags.map((t) => t.id));
    }
  }, [creatorDetail?.tags]);

  useEffect(() => {
    if (selectedActorDetail) {
      setAdditionalActors((prev) => mergeById(prev, [selectedActorDetail]));
    }
  }, [selectedActorDetail]);

  useEffect(() => {
    if (editId && creatorDetail) {
      setEditing(creatorDetail);
      setFormName(creatorDetail.name);
      setFormType(creatorDetail.type);
      setFormActorId(creatorDetail.actorId ?? '');
      if (creatorDetail.actorId != null) {
        const actor = (actorsData?.items ?? []).find((it) => it.id === creatorDetail.actorId);
        if (actor) {
          setAdditionalActors((prev) => mergeById(prev, [actor as Actor]));
        }
      }
      setFormPlatform(creatorDetail.platform ?? '');
      setFormPlatformId(creatorDetail.platformId ?? '');
      setFormOpen(true);
    }
  }, [actorsData?.items, creatorDetail, editId]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    setAdditionalActors([]);
    setAdditionalTags([]);
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

  const selectedActor =
    formActorId === ''
      ? null
      : actors.find((a) => a.id === formActorId) ?? selectedActorDetail ?? null;
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
          创作者
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
          <EntityCreateSingleAutocomplete<Actor>
            label="关联演员"
            placeholder="搜索演员，不存在可直接新建"
            options={actors}
            value={selectedActor}
            onChange={(actor) => setFormActorId(actor?.id ?? '')}
            pageSize={ENTITY_SELECTOR_PAGE_SIZE}
            loadOptions={({ keyword, page, pageSize }) =>
              keyword.trim()
                ? searchActors(keyword.trim(), page, pageSize)
                : fetchActorsList(page, pageSize)
            }
            getOptionLabel={(a) => a.name}
            renderOption={(_, a) => <EntityPreview entityType="actor" entity={a} inline />}
            onCreate={async (name) => actorCreateMut.mutateAsync({ name })}
            onCreated={(entity) => setAdditionalActors((prev) => mergeById(prev, [entity]))}
          />
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
        title="快速合并创作者"
        onClose={() => setMergeOpen(false)}
        onSubmit={handleMergeSubmit}
        loading={mergeMut.isPending}
        submitDisabled={!mergeValid}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="目标创作者 ID"
            value={mergeTargetIdInput}
            onChange={(e) => setMergeTargetIdInput(e.target.value)}
            required
            fullWidth
            placeholder="例如 201"
          />
          <TextField
            label="待合并 ID（逗号/空格分隔）"
            value={mergeSourceIdsInput}
            onChange={(e) => setMergeSourceIdsInput(e.target.value)}
            required
            fullWidth
            placeholder="例如 202,203,204"
            helperText="会将待合并创作者的视频关联、标签、策略引用迁移到目标 ID"
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

