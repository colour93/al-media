import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button } from '@mui/material';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import { useTagTypesList, useTagType, useTagTypeCreate, useTagTypeUpdate, useTagTypeDelete } from '../hooks/useTagTypes';
import { IconPicker } from '../components/IconPicker/IconPicker';
import { getLucideIcon } from '../utils/lucideIcons';
import { validateListSearch } from '../schemas/listSearch';
import type { TagType } from '../api/types';
import { TextField } from '@mui/material';

export const Route = createFileRoute('/tag-types')({
  validateSearch: validateListSearch,
  component: TagTypesPage,
});

function TagTypesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, editId } = Route.useSearch();

  const { data, isLoading } = useTagTypesList(page, pageSize, keyword);
  const { data: tagTypeDetail } = useTagType(editId ?? null);
  const createMut = useTagTypeCreate();
  const updateMut = useTagTypeUpdate();
  const deleteMut = useTagTypeDelete();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TagType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagType | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormName('');
    setFormIcon(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (row: TagType) => {
    setEditing(row);
    setFormName(row.name);
    setFormIcon(row.icon ?? null);
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: { name: formName, icon: formIcon ?? undefined } });
    } else {
      await createMut.mutateAsync({ name: formName, icon: formIcon ?? undefined });
    }
    handleFormClose();
  };

  useEffect(() => {
    if (editId && tagTypeDetail) {
      setEditing(tagTypeDetail);
      setFormName(tagTypeDetail.name);
      setFormIcon(tagTypeDetail.icon ?? null);
      setFormOpen(true);
    }
  }, [editId, tagTypeDetail]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    if (editId) {
      navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const columns: DataTableColumn<TagType>[] = [
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id },
    { id: 'name', label: '名称', render: (r) => r.name },
    {
      id: 'icon',
      label: '图标',
      width: 60,
      render: (r) => {
        const Icon = getLucideIcon(r.icon);
        return Icon ? <Icon size={20} strokeWidth={1.5} /> : '-';
      },
    },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          标签类型
        </Typography>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
          新建
        </Button>
      </Box>

      <DataTable<TagType>
        tableId="tag-types"
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
        searchPlaceholder="搜索标签类型…"
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearch={(k) => navigate({ search: (prev) => ({ ...prev, keyword: k, page: 1 }) })}
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
        emptyMessage="暂无标签类型"
      />

      <FormDialog
        open={formOpen}
        title={editing ? '编辑标签类型' : '新建标签类型'}
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
          <IconPicker value={formIcon} onChange={setFormIcon} />
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
