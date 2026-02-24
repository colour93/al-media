import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button, TextField, Switch } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import {
  useFileDirsList,
  useFileDirCreate,
  useFileDirUpdate,
  useFileDirDelete,
} from '../hooks/useFileDirs';
import { validateListSearch } from '../schemas/listSearch';
import type { FileDir } from '../api/types';

export const Route = createFileRoute('/file-dirs')({
  validateSearch: validateListSearch,
  component: FileDirsPage,
});

function FileDirsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword } = Route.useSearch();

  const { data, isLoading } = useFileDirsList(page, pageSize, keyword);
  const createMut = useFileDirCreate();
  const updateMut = useFileDirUpdate();
  const deleteMut = useFileDirDelete();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {setSearchDraft(keyword)}, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileDir | null>(null);
  const [formPath, setFormPath] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);

  const handleOpenCreate = () => {
    setFormPath('');
    setFormEnabled(true);
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    await createMut.mutateAsync({ path: formPath, enabled: formEnabled });
    setFormOpen(false);
  };

  const handleToggleEnabled = async (row: FileDir) => {
    await updateMut.mutateAsync({ id: row.id, enabled: !row.enabled });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const columns: DataTableColumn<FileDir>[] = [
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id },
    { id: 'path', label: '路径', render: (r) => r.path },
    {
      id: 'enabled',
      label: '启用',
      width: 80,
      render: (r) => (
        <Switch
          checked={r.enabled}
          onChange={() => handleToggleEnabled(r)}
          disabled={updateMut.isPending}
          size="small"
        />
      ),
    },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          目录管理
        </Typography>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
          新建
        </Button>
      </Box>

      <DataTable<FileDir>
        tableId="file-dirs"
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
        searchPlaceholder="搜索路径…"
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearch={(k) => navigate({ search: (prev) => ({ ...prev, keyword: k, page: 1 }) })}
        actions={(row) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
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
        emptyMessage="暂无目录"
      />

      <FormDialog
        open={formOpen}
        title="新建目录"
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        loading={createMut.isPending}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="路径"
            value={formPath}
            onChange={(e) => setFormPath(e.target.value)}
            required
            fullWidth
            autoFocus
            placeholder="/path/to/videos"
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
        message={deleteTarget ? `确定要删除目录「${deleteTarget.path}」吗？` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMut.isPending}
      />
    </Box>
  );
}
