import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Typography, Button } from '@mui/material';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import {
  useDistributorsList,
  useDistributor,
  useDistributorCreate,
  useDistributorUpdate,
  useDistributorDelete,
  useDistributorMerge,
} from '../hooks/useDistributors';
import { validateListSearch } from '../schemas/listSearch';
import type { Distributor } from '../api/types';
import { TextField } from '@mui/material';

export const Route = createFileRoute('/distributors')({
  validateSearch: validateListSearch,
  component: DistributorsPage,
});

function parseIdList(value: string): number[] {
  return [...new Set(
    value
      .split(/[,\s，]+/)
      .map((it) => Number(it.trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function DistributorsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, editId } = Route.useSearch();

  const { data, isLoading } = useDistributorsList(page, pageSize, keyword);
  const { data: distributorDetail } = useDistributor(editId ?? null);
  const createMut = useDistributorCreate();
  const updateMut = useDistributorUpdate();
  const deleteMut = useDistributorDelete();
  const mergeMut = useDistributorMerge();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {setSearchDraft(keyword)}, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetIdInput, setMergeTargetIdInput] = useState('');
  const [mergeSourceIdsInput, setMergeSourceIdsInput] = useState('');
  const [formName, setFormName] = useState('');
  const [formDomain, setFormDomain] = useState('');

  const handleOpenCreate = () => {
    setEditing(null);
    setFormName('');
    setFormDomain('');
    setFormOpen(true);
  };

  const handleOpenEdit = (row: Distributor) => {
    setEditing(row);
    setFormName(row.name);
    setFormDomain(row.domain ?? '');
    setFormOpen(true);
  };

  useEffect(() => {
    if (editId && distributorDetail) {
      setEditing(distributorDetail);
      setFormName(distributorDetail.name);
      setFormDomain(distributorDetail.domain ?? '');
      setFormOpen(true);
    }
  }, [editId, distributorDetail]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    if (editId) navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
  };

  const handleFormSubmit = async () => {
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id,
        data: { name: formName, domain: formDomain || undefined },
      });
    } else {
      await createMut.mutateAsync({ name: formName, domain: formDomain || undefined });
    }
    handleFormClose();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const columns: DataTableColumn<Distributor>[] = [
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id },
    { id: 'name', label: '名称', render: (r) => r.name },
    { id: 'domain', label: '域名', render: (r) => r.domain ?? '-' },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const mergeTargetId = Number(mergeTargetIdInput);
  const mergeSourceIds = parseIdList(mergeSourceIdsInput);
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
          发行方
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

      <DataTable<Distributor>
        tableId="distributors"
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
        searchPlaceholder="搜索发行方…"
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
        emptyMessage="暂无发行方"
      />

      <FormDialog
        open={formOpen}
        title={editing ? '编辑发行方' : '新建发行方'}
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
            label="域名"
            value={formDomain}
            onChange={(e) => setFormDomain(e.target.value)}
            placeholder="可选"
            fullWidth
          />
        </Box>
      </FormDialog>

      <FormDialog
        open={mergeOpen}
        title="快速合并发行方"
        onClose={() => setMergeOpen(false)}
        onSubmit={handleMergeSubmit}
        loading={mergeMut.isPending}
        submitDisabled={!mergeValid}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="目标发行方 ID"
            value={mergeTargetIdInput}
            onChange={(e) => setMergeTargetIdInput(e.target.value)}
            required
            fullWidth
            placeholder="例如 301"
          />
          <TextField
            label="待合并 ID（逗号/空格分隔）"
            value={mergeSourceIdsInput}
            onChange={(e) => setMergeSourceIdsInput(e.target.value)}
            required
            fullWidth
            placeholder="例如 302,303,304"
            helperText="会将待合并发行方的视频关联迁移到目标 ID"
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

