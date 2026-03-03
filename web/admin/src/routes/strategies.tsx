import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Box,
  Typography,
  Button,
  TextField,
  Switch,
  MenuItem,
  Chip,
} from '@mui/material';
import { Plus, Pencil, Trash2, Play } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import {
  useBindingStrategiesList,
  useBindingStrategy,
  useBindingStrategyCreate,
  useBindingStrategyUpdate,
  useBindingStrategyDelete,
  useApplyStrategy,
} from '../hooks/useBindingStrategies';
import { useFileDirsList } from '../hooks/useFileDirs';
import { useTagsList } from '../hooks/useTags';
import { useActorCreate, useActorsList } from '../hooks/useActors';
import { useCreatorCreate, useCreatorsList } from '../hooks/useCreators';
import { fetchTagsList, searchTags } from '../api/tags';
import { fetchActorsList, searchActors } from '../api/actors';
import { fetchCreatorsList, searchCreators } from '../api/creators';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { EntityCreateAutocomplete } from '../components/EntityCreateAutocomplete/EntityCreateAutocomplete';
import { renderLucideIcon } from '../utils/lucideIcons';
import { validateListSearch } from '../schemas/listSearch';
import type { BindingStrategy, Tag, TagType, Actor, Creator, FileDir } from '../api/types';

const STRATEGY_TYPES = [
  { value: 'folder' as const, label: '文件夹' },
  { value: 'regex' as const, label: '正则' },
];

export const Route = createFileRoute('/strategies')({
  validateSearch: validateListSearch,
  component: StrategiesPage,
});

const ENTITY_SELECTOR_PAGE_SIZE = 20;

function mergeById<T extends { id: number }>(base: T[], extra: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of [...base, ...extra]) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function formatBindingSummary(s: BindingStrategy): string {
  const parts: string[] = [];
  if (s.tagIds?.length) parts.push(`${s.tagIds.length} 标签`);
  if (s.creatorIds?.length) parts.push(`${s.creatorIds.length} 创作者`);
  if (s.actorIds?.length) parts.push(`${s.actorIds.length} 演员`);
  return parts.length ? parts.join('、') : '-';
}

function StrategiesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder, editId } = Route.useSearch();

  const { data, isLoading } = useBindingStrategiesList(page, pageSize, sortBy, sortOrder);
  const [editing, setEditing] = useState<BindingStrategy | null>(null);
  const strategyIdToFetch = editing?.id ?? editId ?? null;
  const { data: strategyDetail } = useBindingStrategy(strategyIdToFetch);
  const { data: fileDirsData } = useFileDirsList(1, 100, '');
  const { data: tagsData } = useTagsList(1, 100, '');
  const { data: actorsData } = useActorsList(1, 100, '');
  const { data: creatorsData } = useCreatorsList(1, 100, '');

  const createMut = useBindingStrategyCreate();
  const updateMut = useBindingStrategyUpdate();
  const deleteMut = useBindingStrategyDelete();
  const applyMut = useApplyStrategy();
  const actorCreateMut = useActorCreate();
  const creatorCreateMut = useCreatorCreate();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BindingStrategy | null>(null);
  const [formType, setFormType] = useState<'folder' | 'regex'>('folder');
  const [formFileDirId, setFormFileDirId] = useState<number | ''>('');
  const [formFolderPath, setFormFolderPath] = useState('');
  const [formFilenameRegex, setFormFilenameRegex] = useState('');
  const [formTagIds, setFormTagIds] = useState<number[]>([]);
  const [formCreatorIds, setFormCreatorIds] = useState<number[]>([]);
  const [formActorIds, setFormActorIds] = useState<number[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [additionalTags, setAdditionalTags] = useState<(Tag & { tagType?: TagType })[]>([]);
  const [additionalActors, setAdditionalActors] = useState<Actor[]>([]);
  const [additionalCreators, setAdditionalCreators] = useState<Creator[]>([]);

  const fileDirs = (fileDirsData?.items ?? []) as FileDir[];
  const tags = useMemo(
    () =>
      mergeById(
        (tagsData?.items ?? []) as (Tag & { tagType?: TagType })[],
        additionalTags
      ),
    [additionalTags, tagsData?.items]
  );
  const actors = useMemo(
    () => mergeById((actorsData?.items ?? []) as Actor[], additionalActors),
    [actorsData?.items, additionalActors]
  );
  const creators = useMemo(
    () => mergeById((creatorsData?.items ?? []) as Creator[], additionalCreators),
    [additionalCreators, creatorsData?.items]
  );

  const handleOpenCreate = () => {
    setEditing(null);
    setFormType('folder');
    setFormFileDirId('');
    setFormFolderPath('');
    setFormFilenameRegex('');
    setFormTagIds([]);
    setFormCreatorIds([]);
    setFormActorIds([]);
    setFormEnabled(true);
    setAdditionalTags([]);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    setFormOpen(true);
  };

  const handleOpenEdit = (row: BindingStrategy) => {
    setEditing(row);
    setFormType(row.type);
    setFormFileDirId(row.fileDirId);
    setFormFolderPath(row.folderPath ?? '');
    setFormFilenameRegex(row.filenameRegex ?? '');
    setFormTagIds(row.tagIds ?? []);
    setFormCreatorIds(row.creatorIds ?? []);
    setFormActorIds(row.actorIds ?? []);
    setFormEnabled(row.enabled);
    setAdditionalTags([]);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    setFormOpen(true);
  };

  useEffect(() => {
    if (strategyDetail) {
      setFormType(strategyDetail.type);
      setFormFileDirId(strategyDetail.fileDirId);
      setFormFolderPath(strategyDetail.folderPath ?? '');
      setFormFilenameRegex(strategyDetail.filenameRegex ?? '');
      setFormTagIds(strategyDetail.tagIds ?? []);
      setFormCreatorIds(strategyDetail.creatorIds ?? []);
      setFormActorIds(strategyDetail.actorIds ?? []);
      setFormEnabled(strategyDetail.enabled);
    }
  }, [strategyDetail]);

  useEffect(() => {
    if (editId && strategyDetail) {
      setEditing(strategyDetail);
      setFormOpen(true);
    }
  }, [editId, strategyDetail]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    setAdditionalTags([]);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    if (editId) navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
  };

  const handleFormSubmit = async () => {
    const payload = {
      type: formType,
      fileDirId: formFileDirId as number,
      folderPath: formType === 'folder' ? formFolderPath.trim() || null : null,
      filenameRegex: formType === 'regex' ? formFilenameRegex.trim() || null : null,
      tagIds: formTagIds,
      creatorIds: formCreatorIds,
      actorIds: formActorIds,
      enabled: formEnabled,
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

  const handleApply = async (row: BindingStrategy) => {
    await applyMut.mutateAsync(row.id);
  };

  const columns: DataTableColumn<BindingStrategy>[] = [
    { id: 'id', label: 'ID', width: 70, render: (r) => r.id, sortable: true, sortKey: 'id' },
    {
      id: 'type',
      label: '类型',
      width: 90,
      render: (r) => (r.type === 'folder' ? '文件夹' : '正则'),
      sortable: true,
      sortKey: 'type',
    },
    {
      id: 'fileDir',
      label: '目录',
      render: (r) => (r.fileDir as { path?: string })?.path ?? `#${r.fileDirId}`,
    },
    {
      id: 'rule',
      label: '匹配规则',
      render: (r) =>
        r.type === 'folder' ? (r.folderPath ?? '-') : (r.filenameRegex ?? '-'),
    },
    {
      id: 'targets',
      label: '绑定目标',
      render: (r) => formatBindingSummary(r),
    },
    {
      id: 'enabled',
      label: '启用',
      width: 75,
      render: (r) => (
        <Switch
          checked={r.enabled}
          onChange={() =>
            updateMut.mutate({
              id: r.id,
              data: { enabled: !r.enabled },
            })
          }
          disabled={updateMut.isPending}
          size="small"
        />
      ),
    },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const selectedTags = tags.filter((t) => formTagIds.includes(t.id));
  const selectedCreators = creators.filter((c) => formCreatorIds.includes(c.id));
  const selectedActors = actors.filter((a) => formActorIds.includes(a.id));

  const formValid =
    formType === 'folder'
      ? formFolderPath.trim().length > 0 && formFileDirId !== ''
      : formFilenameRegex.trim().length > 0 && formFileDirId !== '';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          绑定策略
        </Typography>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
          新建
        </Button>
      </Box>

      <DataTable<BindingStrategy>
        tableId="strategies"
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
        searchPlaceholder=""
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearch={() => {}}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(by, order) =>
          navigate({ search: (prev) => ({ ...prev, sortBy: by, sortOrder: order, page: 1 }) })
        }
        actions={(row) => (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Button
              size="small"
              startIcon={<Play size={14} />}
              onClick={() => handleApply(row)}
              disabled={applyMut.isPending}
            >
              应用
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
        emptyMessage="暂无策略"
      />

      <FormDialog
        open={formOpen}
        title={editing ? '编辑策略' : '新建策略'}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        loading={createMut.isPending || updateMut.isPending}
        submitDisabled={!formValid}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            select
            label="类型"
            value={formType}
            onChange={(e) => setFormType(e.target.value as 'folder' | 'regex')}
            fullWidth
            required
          >
            {STRATEGY_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="文件目录"
            value={formFileDirId}
            onChange={(e) =>
              setFormFileDirId(e.target.value === '' ? '' : Number(e.target.value))
            }
            fullWidth
            required
          >
            <MenuItem value="">请选择</MenuItem>
            {fileDirs.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.path}
              </MenuItem>
            ))}
          </TextField>
          {formType === 'folder' && (
            <TextField
              label="文件夹路径前缀"
              value={formFolderPath}
              onChange={(e) => setFormFolderPath(e.target.value)}
              placeholder="例如 actor-a/"
              fullWidth
              required
            />
          )}
          {formType === 'regex' && (
            <TextField
              label="文件名正则"
              value={formFilenameRegex}
              onChange={(e) => setFormFilenameRegex(e.target.value)}
              placeholder="例如 .*\\.mp4$"
              fullWidth
              required
            />
          )}
          <EntityCreateAutocomplete<Tag & { tagType?: TagType }>
            label="标签"
            placeholder="搜索并选择要绑定的标签"
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
                entity={t}
                inline
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((t, index) => {
                const tagWithType = t as Tag & { tagType?: TagType };
                const iconEl = tagWithType.tagType?.icon
                  ? renderLucideIcon(tagWithType.tagType.icon, { size: 12 })
                  : null;
                const label = tagWithType.tagType?.name
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
                      '& .MuiChip-label': {
                        color: t.color ? 'rgba(0,0,0,0.7)' : 'inherit',
                      },
                    }}
                  />
                );
              })
            }
          />
          <EntityCreateAutocomplete<Creator>
            label="创作者"
            placeholder="搜索创作者，不存在可直接新建"
            options={creators}
            value={selectedCreators}
            onChange={setFormCreatorIds}
            pageSize={ENTITY_SELECTOR_PAGE_SIZE}
            loadOptions={({ keyword, page, pageSize }) =>
              keyword.trim()
                ? searchCreators(keyword.trim(), page, pageSize)
                : fetchCreatorsList(page, pageSize)
            }
            getOptionLabel={(c) => c.name}
            renderOption={(_, c) => <EntityPreview entityType="creator" entity={c} inline />}
            onCreate={async (name) => creatorCreateMut.mutateAsync({ name, type: 'person' })}
            onCreated={(entity) => setAdditionalCreators((prev) => mergeById(prev, [entity]))}
          />
          <EntityCreateAutocomplete<Actor>
            label="演员"
            placeholder="搜索演员，不存在可直接新建"
            options={actors}
            value={selectedActors}
            onChange={setFormActorIds}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={formEnabled}
              onChange={(e) => setFormEnabled(e.target.checked)}
            />
            <Typography>启用</Typography>
          </Box>
        </Box>
      </FormDialog>

      <DeleteConfirm
        open={!!deleteTarget}
        message={
          deleteTarget
            ? `确定要删除策略「${deleteTarget.type === 'folder' ? deleteTarget.folderPath : deleteTarget.filenameRegex}」吗？`
            : ''
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMut.isPending}
      />
    </Box>
  );
}
