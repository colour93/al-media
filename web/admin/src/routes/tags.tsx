import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button, TextField, MenuItem } from '@mui/material';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import { useTagsList, useTag, useTagCreate, useTagUpdate, useTagDelete } from '../hooks/useTags';
import { useTagTypesList } from '../hooks/useTagTypes';
import { ColorPicker } from '../components/ColorPicker/ColorPicker';
import { getLucideIcon } from '../utils/lucideIcons';
import { validateListSearch } from '../schemas/listSearch';
import type { TagWithType } from '../api/tags';

export const Route = createFileRoute('/tags')({
  validateSearch: validateListSearch,
  component: TagsPage,
});

function TagsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder, editId } = Route.useSearch();

  const { data, isLoading } = useTagsList(page, pageSize, keyword, sortBy, sortOrder);
  const { data: tagDetail } = useTag(editId ?? null);
  const { data: tagTypesData } = useTagTypesList(1, 1000, '');
  const createMut = useTagCreate();
  const updateMut = useTagUpdate();
  const deleteMut = useTagDelete();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {setSearchDraft(keyword)}, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TagWithType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagWithType | null>(null);
  const [formName, setFormName] = useState('');
  const [formTagTypeId, setFormTagTypeId] = useState<number | ''>('');
  const [formColor, setFormColor] = useState<string | null>(null);

  const tagTypes = tagTypesData?.items ?? [];

  const handleOpenCreate = () => {
    setEditing(null);
    setFormName('');
    setFormTagTypeId(tagTypes[0]?.id ?? '');
    setFormColor(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (row: TagWithType) => {
    setEditing(row);
    setFormName(row.name);
    setFormTagTypeId(row.tagTypeId);
    setFormColor(row.color ?? null);
    setFormOpen(true);
  };

  useEffect(() => {
    if (editId && tagDetail) {
      setEditing({
        ...tagDetail,
        tagType: tagTypes.find((tt) => tt.id === tagDetail.tagTypeId),
      } as TagWithType);
      setFormName(tagDetail.name);
      setFormTagTypeId(tagDetail.tagTypeId);
      setFormColor(tagDetail.color ?? null);
      setFormOpen(true);
    }
  }, [editId, tagDetail, tagTypes]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    if (editId) navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
  };

  const handleFormSubmit = async () => {
    const tagTypeId = typeof formTagTypeId === 'number' ? formTagTypeId : tagTypes[0]?.id;
    if (tagTypeId == null) return;
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id,
        data: { name: formName, tagTypeId, color: formColor ?? undefined },
      });
    } else {
      await createMut.mutateAsync({ name: formName, tagTypeId, color: formColor ?? undefined });
    }
    handleFormClose();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const columns: DataTableColumn<TagWithType>[] = [
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id, sortable: true, sortKey: 'id' },
    { id: 'name', label: '名称', render: (r) => r.name, sortable: true, sortKey: 'name' },
    {
      id: 'tagType',
      label: '类型',
      render: (r) => r.tagType?.name ?? r.tagTypeId,
      sortable: true,
      sortKey: 'tagTypeId',
    },
    {
      id: 'color',
      label: '颜色',
      width: 80,
      render: (r) =>
        r.color ? (
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: 0.5,
              bgcolor: r.color,
              border: 1,
              borderColor: 'divider',
            }}
            title={r.color}
          />
        ) : (
          '-'
        ),
    },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          标签管理
        </Typography>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
          新建
        </Button>
      </Box>

      <DataTable<TagWithType>
        tableId="tags"
        columns={columns}
        rows={items}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })}
        onPageSizeChange={(ps) => navigate({ search: (prev) => ({ ...prev, pageSize: ps, page: 1 }) })}
        loading={isLoading}
        searchPlaceholder="搜索标签…"
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
        emptyMessage="暂无标签"
      />

      <FormDialog
        open={formOpen}
        title={editing ? '编辑标签' : '新建标签'}
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
          <TextField
            select
            label="标签类型"
            value={formTagTypeId}
            onChange={(e) => setFormTagTypeId(Number(e.target.value))}
            required
            fullWidth
          >
            {tagTypes.map((tt) => (
              <MenuItem key={tt.id} value={tt.id}>
                {tt.name}
              </MenuItem>
            ))}
          </TextField>
          <ColorPicker value={formColor} onChange={setFormColor} />
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
