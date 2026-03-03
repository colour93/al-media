import { useState, useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Box, Typography, Button, TextField, Checkbox, MenuItem } from '@mui/material';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

export const Route = createFileRoute('/distributors')({
  validateSearch: validateListSearch,
  component: DistributorsPage,
});

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
  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<Set<number>>(new Set());
  const [mergeTargetId, setMergeTargetId] = useState<number | ''>('');
  const [formName, setFormName] = useState('');
  const [formDomain, setFormDomain] = useState('');

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const selectedDistributors = useMemo(
    () => items.filter((distributor) => selectedDistributorIds.has(distributor.id)),
    [items, selectedDistributorIds]
  );
  const selectedOnPageCount = selectedDistributors.length;
  const allOnPageSelected = items.length > 0 && selectedOnPageCount === items.length;
  const someOnPageSelected = selectedOnPageCount > 0 && selectedOnPageCount < items.length;
  const mergeSourceIds = useMemo(
    () =>
      typeof mergeTargetId === 'number'
        ? selectedDistributors
            .map((distributor) => distributor.id)
            .filter((id) => id !== mergeTargetId)
        : [],
    [mergeTargetId, selectedDistributors]
  );
  const mergeValid = typeof mergeTargetId === 'number' && mergeSourceIds.length > 0;

  useEffect(() => {
    if (editId && distributorDetail) {
      setEditing(distributorDetail);
      setFormName(distributorDetail.name);
      setFormDomain(distributorDetail.domain ?? '');
      setFormOpen(true);
    }
  }, [editId, distributorDetail]);

  useEffect(() => {
    const pageIds = new Set(items.map((distributor) => distributor.id));
    setSelectedDistributorIds((prev) => {
      const next = new Set<number>();
      let changed = false;
      for (const id of prev) {
        if (pageIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [items]);

  useEffect(() => {
    if (!mergeOpen) return;
    if (selectedDistributors.length < 2) {
      setMergeOpen(false);
      setMergeTargetId('');
      return;
    }
    if (
      typeof mergeTargetId !== 'number' ||
      !selectedDistributors.some((distributor) => distributor.id === mergeTargetId)
    ) {
      setMergeTargetId(selectedDistributors[0]?.id ?? '');
    }
  }, [mergeOpen, mergeTargetId, selectedDistributors]);

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

  const toggleDistributorSelect = (id: number) => {
    setSelectedDistributorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllDistributors = () => {
    setSelectedDistributorIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const distributor of items) next.delete(distributor.id);
      } else {
        for (const distributor of items) next.add(distributor.id);
      }
      return next;
    });
  };

  const handleOpenMerge = () => {
    if (selectedDistributors.length < 2) return;
    setMergeTargetId(selectedDistributors[0]?.id ?? '');
    setMergeOpen(true);
  };

  const handleMergeClose = () => {
    setMergeOpen(false);
    setMergeTargetId('');
  };

  const handleMergeSubmit = async () => {
    if (!mergeValid || typeof mergeTargetId !== 'number') return;
    await mergeMut.mutateAsync({ targetId: mergeTargetId, sourceIds: mergeSourceIds });
    setMergeOpen(false);
    setMergeTargetId('');
    setSelectedDistributorIds(new Set());
  };

  const columns: DataTableColumn<Distributor>[] = [
    {
      id: '_select',
      label: (
        <Checkbox
          size="small"
          checked={allOnPageSelected}
          indeterminate={someOnPageSelected}
          onChange={toggleSelectAllDistributors}
        />
      ),
      width: 48,
      align: 'center' as const,
      render: (r) => (
        <Checkbox
          size="small"
          checked={selectedDistributorIds.has(r.id)}
          onChange={() => toggleDistributorSelect(r.id)}
        />
      ),
    },
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id },
    { id: 'name', label: '名称', render: (r) => r.name },
    { id: 'domain', label: '域名', render: (r) => r.domain ?? '-' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          发行方
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" disabled={selectedDistributors.length < 2} onClick={handleOpenMerge}>
            快速合并 ({selectedDistributors.length})
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
        searchPlaceholder="搜索发行方..."
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
        onClose={handleMergeClose}
        onSubmit={handleMergeSubmit}
        loading={mergeMut.isPending}
        submitDisabled={!mergeValid}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            已选择 {selectedDistributors.length} 个发行方。请选择一个作为目标，其余将合并到该目标。
          </Typography>
          <TextField
            select
            label="目标发行方"
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(Number(e.target.value))}
            required
            fullWidth
          >
            {selectedDistributors.map((distributor) => (
              <MenuItem key={distributor.id} value={distributor.id}>
                {distributor.name} (ID: {distributor.id})
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            待合并 ID: {mergeSourceIds.length > 0 ? mergeSourceIds.join(', ') : '-'}
          </Typography>
        </Box>
      </FormDialog>

      <DeleteConfirm
        open={!!deleteTarget}
        message={deleteTarget ? `确定要删除“${deleteTarget.name}”吗？` : ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteMut.isPending}
      />
    </Box>
  );
}
