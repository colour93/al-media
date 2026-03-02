import { useState, useEffect, useRef, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  Switch,
  Paper,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Play,
  Plus,
  List,
  FolderTree,
  Search,
  ChevronRight,
  ChevronDown,
  Tags,
  Pause,
  Square,
  X,
  RefreshCw,
  ShieldBan,
  Pencil,
  Trash2,
} from 'lucide-react';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { VideoPreviewDialog } from '../components/VideoPreviewDialog/VideoPreviewDialog';
import {
  useVideoFilesList,
  useVideoFileScanTask,
  useStartVideoFileScanTask,
  usePauseVideoFileScanTask,
  useResumeVideoFileScanTask,
  useStopVideoFileScanTask,
  useCancelVideoFileScanTask,
  useVideoFileIndexStrategiesList,
  useVideoFileIndexStrategyCreate,
  useVideoFileIndexStrategyUpdate,
  useVideoFileIndexStrategyDelete,
  useApplyVideoFileIndexStrategy,
} from '../hooks/useVideoFiles';
import { useVideoInsertFromFile, useVideoInferTask } from '../hooks/useVideos';
import { batchAddTagsToVideos, batchAddActorsToVideos, batchAddCreatorsToVideos } from '../api/videos';
import { useActorsList } from '../hooks/useActors';
import { useCreatorsList } from '../hooks/useCreators';
import { useTagsList } from '../hooks/useTags';
import { useFileDirsList } from '../hooks/useFileDirs';
import { getFileUrl } from '../api/file';
import { renderLucideIcon } from '../utils/lucideIcons';
import { formatDurationHuman } from '../utils/format';
import { useQueryClient } from '@tanstack/react-query';
import { validateListSearch } from '../schemas/listSearch';
import type { VideoFile } from '../api/types';
import type { Actor } from '../api/types';
import type { Creator } from '../api/types';
import type { FileDir, Tag, TagType, VideoFileIndexStrategy } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TreeNode {
  id: string;
  name: string;
  path: string;
  children: TreeNode[];
  files: VideoFile[];
}

function buildFolderTree(items: VideoFile[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();

  const getOrCreate = (path: string, name: string): TreeNode => {
    const id = path || '__root__';
    let node = nodeMap.get(id);
    if (!node) {
      node = { id, name: name || '根目录', path, children: [], files: [] };
      nodeMap.set(id, node);
    }
    return node;
  };

  const rootPaths = new Set<string>();

  for (const f of items) {
    const base = ((f as VideoFile & { fileDir?: { path?: string } }).fileDir?.path ?? '').replace(/\/+$/, '');
    const folder = f.fileKey.includes('/') ? f.fileKey.split('/').slice(0, -1).join('/') : '';

    if (folder) {
      const parts = folder.split('/').filter(Boolean);
      let parentPath = base;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const fullPath = parentPath ? `${parentPath}/${part}` : part;
        const node = getOrCreate(fullPath, part);

        if (i === 0 && base) {
          rootPaths.add(base);
        }
        if (parentPath) {
          const parent = getOrCreate(parentPath, parentPath.split('/').pop() ?? '');
          if (!parent.children.some((c) => c.id === node.id)) {
            parent.children.push(node);
          }
        }
        parentPath = fullPath;
      }
      const leaf = getOrCreate(parentPath, parts[parts.length - 1] ?? '');
      leaf.files.push(f);
    } else {
      const node = getOrCreate(base || '__root__', base ? base.split('/').pop() ?? '根目录' : '根目录');
      node.files.push(f);
      if (base) rootPaths.add(base);
    }
  }

  const roots: TreeNode[] = [];
  const rootNode = nodeMap.get('__root__');
  if (rootNode) {
    roots.push(rootNode);
  }
  for (const p of Array.from(rootPaths).sort()) {
    const node = nodeMap.get(p);
    if (node && !roots.some((r) => r.id === node.id)) {
      roots.push(node);
    }
  }

  function sortChildren(n: TreeNode) {
    n.children.sort((a, b) => a.name.localeCompare(b.name));
    n.children.forEach(sortChildren);
  }
  roots.forEach(sortChildren);

  return roots.length ? roots : rootNode ? [rootNode] : [];
}

const scanStatusLabelMap: Record<string, string> = {
  pending: '等待中',
  processing: '索引中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
  aborted: '已取消',
  stopped: '已停止',
};

function formatScanStatus(status?: string): string {
  if (!status) return '未开始';
  return scanStatusLabelMap[status] ?? status;
}

const inferSourceLabelMap: Record<string, string> = {
  'admin-infer-preview': '手动预览推理',
  'video-re-extract': '视频重新推断',
  'video-auto-extract': '自动提取',
};

function formatInferSource(source?: string): string {
  if (!source) return '未知来源';
  return inferSourceLabelMap[source] ?? source;
}

export const Route = createFileRoute('/video-files')({
  validateSearch: validateListSearch,
  component: VideoFilesPage,
});

function VideoFilesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder } = Route.useSearch();
  const queryClient = useQueryClient();

  const { data, isLoading } = useVideoFilesList(page, pageSize, keyword, sortBy, sortOrder);
  const { data: fileDirsData } = useFileDirsList(1, 100, '');
  const { data: scanTask } = useVideoFileScanTask();
  const { data: inferTask } = useVideoInferTask();
  const startScanMut = useStartVideoFileScanTask();
  const pauseScanMut = usePauseVideoFileScanTask();
  const resumeScanMut = useResumeVideoFileScanTask();
  const stopScanMut = useStopVideoFileScanTask();
  const cancelScanMut = useCancelVideoFileScanTask();
  const { data: indexStrategiesData, isLoading: indexStrategiesLoading } =
    useVideoFileIndexStrategiesList(1, 100, '', 'id', 'desc');
  const createIndexStrategyMut = useVideoFileIndexStrategyCreate();
  const updateIndexStrategyMut = useVideoFileIndexStrategyUpdate();
  const deleteIndexStrategyMut = useVideoFileIndexStrategyDelete();
  const applyIndexStrategyMut = useApplyVideoFileIndexStrategy();
  const { data: actorsData } = useActorsList(1, 50, '');
  const { data: creatorsData } = useCreatorsList(1, 50, '');
  const { data: tagsData } = useTagsList(1, 50, '');

  const insertMut = useVideoInsertFromFile();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);
  const [previewVideoFileId, setPreviewVideoFileId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'folder'>('table');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTagIds, setBatchTagIds] = useState<number[]>([]);
  const [batchActorIds, setBatchActorIds] = useState<number[]>([]);
  const [batchCreatorIds, setBatchCreatorIds] = useState<number[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [scanFileDirId, setScanFileDirId] = useState<number | ''>('');
  const [indexStrategyFormOpen, setIndexStrategyFormOpen] = useState(false);
  const [editingIndexStrategy, setEditingIndexStrategy] = useState<VideoFileIndexStrategy | null>(null);
  const [indexStrategyDeleteTarget, setIndexStrategyDeleteTarget] = useState<VideoFileIndexStrategy | null>(null);
  const [indexStrategyFileDirId, setIndexStrategyFileDirId] = useState<number | 'all'>('all');
  const [indexStrategyRegex, setIndexStrategyRegex] = useState('');
  const [indexStrategyEnabled, setIndexStrategyEnabled] = useState(true);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (viewMode !== 'folder') return;
    const id = setTimeout(
      () => navigate({ search: (prev) => ({ ...prev, keyword: searchDraft, page: 1 }) }),
      300
    );
    searchDebounceRef.current = id;
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [viewMode, searchDraft, navigate]);

  const items = useMemo(() => (data?.items ?? []) as VideoFile[], [data?.items]);
  const total = data?.total ?? 0;
  const fileDirs = (fileDirsData?.items ?? []) as FileDir[];
  const enabledFileDirs = useMemo(() => fileDirs.filter((dir) => dir.enabled), [fileDirs]);
  const actors = actorsData?.items ?? [];
  const creators = creatorsData?.items ?? [];
  const tags = (tagsData?.items ?? []) as (Tag & { tagType?: TagType })[];
  const indexStrategies = (indexStrategiesData?.items ?? []) as VideoFileIndexStrategy[];

  useEffect(() => {
    if (enabledFileDirs.length === 0) {
      if (scanFileDirId !== '') {
        setScanFileDirId('');
      }
      return;
    }
    if (scanFileDirId === '' || !enabledFileDirs.some((dir) => dir.id === scanFileDirId)) {
      setScanFileDirId(enabledFileDirs[0]?.id ?? '');
    }
  }, [enabledFileDirs, scanFileDirId]);

  const itemMap = useMemo(() => new Map(items.map((f) => [f.id, f])), [items]);

  const toggleFileSelect = (id: number) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getFileIdsInNode = (node: TreeNode): number[] => {
    const ids = node.files.map((f) => f.id);
    for (const child of node.children) {
      ids.push(...getFileIdsInNode(child));
    }
    return ids;
  };

  const toggleFolderSelect = (node: TreeNode) => {
    const ids = getFileIdsInNode(node);
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const isFolderFullySelected = (node: TreeNode): boolean => {
    const ids = getFileIdsInNode(node);
    return ids.length > 0 && ids.every((id) => selectedFileIds.has(id));
  };

  const isFolderPartiallySelected = (node: TreeNode): boolean => {
    const ids = getFileIdsInNode(node);
    const selected = ids.filter((id) => selectedFileIds.has(id)).length;
    return selected > 0 && selected < ids.length;
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.size === items.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(items.map((f) => f.id)));
    }
  };

  const handleBatchApply = async () => {
    if (selectedFileIds.size === 0) return;
    if (batchTagIds.length === 0 && batchActorIds.length === 0 && batchCreatorIds.length === 0) return;

    setBatchSubmitting(true);
    try {
      const videoIds: number[] = [];
      const selectedItems = Array.from(selectedFileIds)
        .map((id) => itemMap.get(id))
        .filter((f): f is VideoFile => !!f);

      for (const vf of selectedItems) {
        let videoId: number | null = null;
        if (vf.video?.id) {
          videoId = vf.video.id;
        } else {
          const video = await insertMut.mutateAsync({
            videoFileId: vf.id,
            autoExtract: true,
          });
          videoId = video.id;
        }
        if (videoId) videoIds.push(videoId);
      }

      if (videoIds.length === 0) return;

      if (batchTagIds.length > 0) {
        await batchAddTagsToVideos(videoIds, batchTagIds);
      }
      if (batchActorIds.length > 0) {
        await batchAddActorsToVideos(videoIds, batchActorIds);
      }
      if (batchCreatorIds.length > 0) {
        await batchAddCreatorsToVideos(videoIds, batchCreatorIds);
      }

      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['videoFiles'] });
      setBatchOpen(false);
      setBatchTagIds([]);
      setBatchActorIds([]);
      setBatchCreatorIds([]);
      setSelectedFileIds(new Set());
    } finally {
      setBatchSubmitting(false);
    }
  };

  const isTaskProcessing = scanTask?.status === 'processing';
  const isTaskPaused = scanTask?.status === 'paused';
  const isTaskPending = scanTask?.status === 'pending';
  const isTaskActive = isTaskProcessing || isTaskPaused || isTaskPending;
  const scanProgressPercent =
    scanTask && scanTask.totalFileCount > 0
      ? Math.min(100, Math.floor((scanTask.currentFileCount / scanTask.totalFileCount) * 100))
      : 0;
  const scanProgressText = scanTask
    ? `${scanTask.currentFileCount} / ${scanTask.totalFileCount || '-'}`
    : '0 / 0';
  const scanTaskMutating =
    startScanMut.isPending ||
    pauseScanMut.isPending ||
    resumeScanMut.isPending ||
    stopScanMut.isPending ||
    cancelScanMut.isPending;
  const hasEnabledScanDir = enabledFileDirs.length > 0;
  const inferTaskProcessing = inferTask?.status === 'processing';

  const handleStartScanTask = async (force: boolean) => {
    if (scanFileDirId === '') return;
    if (!enabledFileDirs.some((dir) => dir.id === Number(scanFileDirId))) return;
    await startScanMut.mutateAsync({ fileDirId: Number(scanFileDirId), force });
  };

  const handleOpenCreateIndexStrategy = () => {
    setEditingIndexStrategy(null);
    setIndexStrategyFileDirId('all');
    setIndexStrategyRegex('');
    setIndexStrategyEnabled(true);
    setIndexStrategyFormOpen(true);
  };

  const handleOpenEditIndexStrategy = (strategy: VideoFileIndexStrategy) => {
    setEditingIndexStrategy(strategy);
    setIndexStrategyFileDirId(strategy.fileDirId ?? 'all');
    setIndexStrategyRegex(strategy.fileKeyRegex);
    setIndexStrategyEnabled(strategy.enabled);
    setIndexStrategyFormOpen(true);
  };

  const handleCloseIndexStrategyForm = () => {
    setIndexStrategyFormOpen(false);
    setEditingIndexStrategy(null);
  };

  const handleSubmitIndexStrategy = async () => {
    const payload = {
      mode: 'blacklist' as const,
      fileDirId: indexStrategyFileDirId === 'all' ? null : Number(indexStrategyFileDirId),
      fileKeyRegex: indexStrategyRegex.trim(),
      enabled: indexStrategyEnabled,
    };
    if (editingIndexStrategy) {
      await updateIndexStrategyMut.mutateAsync({ id: editingIndexStrategy.id, data: payload });
    } else {
      await createIndexStrategyMut.mutateAsync(payload);
    }
    handleCloseIndexStrategyForm();
  };

  const handleToggleIndexStrategyEnabled = async (row: VideoFileIndexStrategy) => {
    await updateIndexStrategyMut.mutateAsync({
      id: row.id,
      data: { enabled: !row.enabled },
    });
  };

  const handleApplyIndexStrategy = async (row: VideoFileIndexStrategy) => {
    await applyIndexStrategyMut.mutateAsync(row.id);
  };

  const handleDeleteIndexStrategyConfirm = async () => {
    if (!indexStrategyDeleteTarget) return;
    await deleteIndexStrategyMut.mutateAsync(indexStrategyDeleteTarget.id);
    setIndexStrategyDeleteTarget(null);
  };

  const folderTree = useMemo(() => (viewMode === 'folder' ? buildFolderTree(items) : []), [viewMode, items]);

  const columns: DataTableColumn<VideoFile>[] = [
    {
      id: '_select',
      label: (
        <Checkbox
          size="small"
          checked={items.length > 0 && selectedFileIds.size === items.length}
          indeterminate={selectedFileIds.size > 0 && selectedFileIds.size < items.length}
          onChange={toggleSelectAll}
        />
      ),
      width: 48,
      align: 'center' as const,
      render: (r) => (
        <Checkbox
          size="small"
          checked={selectedFileIds.has(r.id)}
          onChange={() => toggleFileSelect(r.id)}
        />
      ),
    },
    { id: 'id', label: 'ID', width: 80, render: (r) => r.id, sortable: true, sortKey: 'id' },
    {
      id: 'thumb',
      label: '缩略图',
      width: 80,
      render: (r) =>
        r.thumbnailKey ? (
          <Box
            component="img"
            src={getFileUrl('thumbnails', r.thumbnailKey)}
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            sx={{ width: 60, height: 45, borderRadius: 0.5, objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              width: 60,
              height: 45,
              borderRadius: 0.5,
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              -
            </Typography>
          </Box>
        ),
    },
    { id: 'fileKey', label: '文件', render: (r) => r.fileKey, sortable: true, sortKey: 'fileKey' },
    {
      id: 'duration',
      label: '时长',
      width: 100,
      render: (r) => formatDurationHuman(r.videoDuration),
    },
    {
      id: 'size',
      label: '大小',
      width: 100,
      render: (r) => formatSize(r.fileSize),
    },
    { id: 'uniqueId', label: '唯一ID', render: (r) => r.uniqueId },
    {
      id: 'video',
      label: '关联视频',
      width: 120,
      render: (r) =>
        r.video ? (
          <EntityPreview entityType="video" entity={r.video} inline />
        ) : (
          '-'
        ),
    },
  ];

  const handleCreateVideo = async (row: VideoFile) => {
    const video = await insertMut.mutateAsync({
      videoFileId: row.id,
    });
    navigate({
      to: '/videos',
      search: { page: 1, pageSize: 10, keyword: '', editId: video.id },
    });
  };

  const actionsColumn = (row: VideoFile) => (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      <Button
        size="small"
        startIcon={<Play size={14} />}
        onClick={() => setPreviewVideoFileId(row.id)}
      >
        预览
      </Button>
      {!row.video && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Plus size={14} />}
          onClick={() => handleCreateVideo(row)}
          disabled={insertMut.isPending}
        >
          新建视频
        </Button>
      )}
    </Box>
  );

  const renderFolderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedPaths.has(node.path) || node.children.length === 0;
    const fileCount = getFileIdsInNode(node).length;

    return (
      <Box key={node.id}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.5,
            px: 1,
            pl: depth * 2 + 1,
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          onClick={() => node.children.length > 0 && toggleExpand(node.path)}
        >
          <Checkbox
            size="small"
            checked={isFolderFullySelected(node)}
            indeterminate={isFolderPartiallySelected(node)}
            onChange={(e) => {
              e.stopPropagation();
              toggleFolderSelect(node);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {node.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown size={16} style={{ marginRight: 4, flexShrink: 0 }} />
            ) : (
              <ChevronRight size={16} style={{ marginRight: 4, flexShrink: 0 }} />
            )
          ) : (
            <Box sx={{ width: 20 }} />
          )}
          <FolderTree size={16} style={{ marginRight: 8, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {node.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {fileCount} 个文件
          </Typography>
        </Box>
        {isExpanded && (
          <>
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
            {node.files.map((f) => (
              <Box
                key={f.id}
                component="li"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.75,
                  px: 1,
                  pl: (depth + 1) * 2 + 1,
                  borderRadius: 1,
                  listStyle: 'none',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Checkbox
                  size="small"
                  checked={selectedFileIds.has(f.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleFileSelect(f.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <Box sx={{ width: 20 }} />
                {f.thumbnailKey ? (
                  <Box
                    component="img"
                    src={getFileUrl('thumbnails', f.thumbnailKey)}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    sx={{ width: 48, height: 36, borderRadius: 0.5, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 48,
                      height: 36,
                      borderRadius: 0.5,
                      bgcolor: 'action.selected',
                      flexShrink: 0,
                    }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {f.fileKey.split('/').pop()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDurationHuman(f.videoDuration)} · {formatSize(f.fileSize)}
                  </Typography>
                </Box>
                {actionsColumn(f)}
              </Box>
            ))}
          </>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          视频文件
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="table" aria-label="表格视图">
              <List size={16} style={{ marginRight: 4 }} />
              表格
            </ToggleButton>
            <ToggleButton value="folder" aria-label="文件夹视图">
              <FolderTree size={16} style={{ marginRight: 4 }} />
              文件夹
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            startIcon={<Tags size={18} />}
            disabled={selectedFileIds.size === 0}
            onClick={() => setBatchOpen(true)}
          >
            批量设置 ({selectedFileIds.size})
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        视频文件由目录扫描自动生成。可多选文件或整文件夹，批量设置标签、演员、创作者（无视频实体时会先新建）。
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RefreshCw size={18} />
              索引任务
            </Typography>
            <Typography variant="body2" color="text.secondary">
              状态：{formatScanStatus(scanTask?.status)}
              {scanTask?.force ? '（强制重索引）' : ''}
              {scanTask?.dir?.path ? ` · 目录：${scanTask.dir.path}` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="目录"
              size="small"
              value={scanFileDirId}
              onChange={(e) =>
                setScanFileDirId(e.target.value === '' ? '' : Number(e.target.value))
              }
              helperText={!hasEnabledScanDir ? '暂无已启用目录，请先到目录管理启用目录' : undefined}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">请选择目录</MenuItem>
              {enabledFileDirs.map((dir) => (
                <MenuItem key={dir.id} value={dir.id}>
                  {dir.path}
                </MenuItem>
              ))}
              {enabledFileDirs.length === 0 && (
                <MenuItem value="" disabled>
                  无可用目录
                </MenuItem>
              )}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleStartScanTask(false)}
              disabled={scanFileDirId === '' || !hasEnabledScanDir || isTaskActive || scanTaskMutating}
            >
              开始索引
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleStartScanTask(true)}
              disabled={scanFileDirId === '' || !hasEnabledScanDir || isTaskActive || scanTaskMutating}
            >
              强制重索引
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={isTaskPaused ? <Play size={14} /> : <Pause size={14} />}
              onClick={() => (isTaskPaused ? resumeScanMut.mutate() : pauseScanMut.mutate())}
              disabled={(!isTaskProcessing && !isTaskPaused) || scanTaskMutating}
            >
              {isTaskPaused ? '继续' : '暂停'}
            </Button>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<Square size={14} />}
              onClick={() => stopScanMut.mutate()}
              disabled={!isTaskActive || scanTaskMutating}
            >
              停止
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<X size={14} />}
              onClick={() => cancelScanMut.mutate()}
              disabled={!isTaskActive || scanTaskMutating}
            >
              取消
            </Button>
          </Box>
        </Box>
        <LinearProgress
          variant={scanTask && isTaskActive && !scanTask.totalFileCount ? 'indeterminate' : 'determinate'}
          value={scanProgressPercent}
          sx={{ mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          进度：{scanProgressText}
          {scanTask?.currentFile ? ` · 当前：${scanTask.currentFile}` : ''}
          {scanTask?.error ? ` · 错误：${scanTask.error}` : ''}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Box>
            <Typography variant="h6">视频信息推理任务</Typography>
            <Typography variant="body2" color="text.secondary">
              状态：{inferTaskProcessing ? '进行中' : '空闲'}
              {inferTask?.current?.source ? ` · 类型：${formatInferSource(inferTask.current.source)}` : ''}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            排队：{inferTask?.waitingCount ?? 0}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {inferTask?.current
            ? `当前：${inferTask.current.target}`
            : inferTask?.lastFinishedAt
              ? `最近完成：${new Date(inferTask.lastFinishedAt).toLocaleString()}`
              : '暂无任务记录'}
          {inferTask?.lastError ? ` · 最近错误：${inferTask.lastError}` : ''}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShieldBan size={18} />
              索引策略
            </Typography>
            <Typography variant="body2" color="text.secondary">
              默认黑名单模式。文件 Key 命中正则时将跳过索引，可应用到已索引文件并移除记录。
            </Typography>
          </Box>
          <Button variant="contained" size="small" onClick={handleOpenCreateIndexStrategy}>
            新建策略
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {indexStrategiesLoading ? (
            <Typography variant="body2" color="text.secondary">
              加载中...
            </Typography>
          ) : indexStrategies.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              暂无索引策略
            </Typography>
          ) : (
            indexStrategies.map((row) => (
              <Box
                key={row.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1.5,
                  py: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    <strong>#{row.id}</strong> · {row.fileKeyRegex}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    模式：黑名单 · 目录：{row.fileDir?.path ?? '全部目录'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Switch
                    size="small"
                    checked={row.enabled}
                    onChange={() => handleToggleIndexStrategyEnabled(row)}
                    disabled={updateIndexStrategyMut.isPending}
                  />
                  <Button
                    size="small"
                    startIcon={<RefreshCw size={14} />}
                    onClick={() => handleApplyIndexStrategy(row)}
                    disabled={applyIndexStrategyMut.isPending}
                  >
                    应用
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Pencil size={14} />}
                    onClick={() => handleOpenEditIndexStrategy(row)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Trash2 size={14} />}
                    onClick={() => setIndexStrategyDeleteTarget(row)}
                  >
                    删除
                  </Button>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Paper>

      {viewMode === 'folder' ? (
        <Box>
          <Box sx={{ p: 2, pb: 0 }}>
            <TextField
              size="small"
              placeholder="搜索文件…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                navigate({ search: (prev) => ({ ...prev, keyword: searchDraft, page: 1 }) })
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 320 }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, p: 2 }}>
            {folderTree.map((node) => renderFolderNode(node, 0))}
          </Box>
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {items.length > 0
                ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} / ${total}`
                : '0 / 0'}
            </Typography>
          </Box>
        </Box>
      ) : (
        <DataTable<VideoFile>
          tableId="video-files"
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
          searchPlaceholder="搜索文件…"
          searchValue={searchDraft}
          onSearchChange={setSearchDraft}
          onSearch={(k) => navigate({ search: (prev) => ({ ...prev, keyword: k, page: 1 }) })}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(by, order) =>
            navigate({ search: (prev) => ({ ...prev, sortBy: by, sortOrder: order, page: 1 }) })
          }
          actions={actionsColumn}
          emptyMessage="暂无视频文件"
        />
      )}

      <Dialog open={batchOpen} onClose={() => setBatchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>批量设置</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            已选 {selectedFileIds.size} 个视频文件。无关联视频的文件将先新建视频再应用设置。
          </Typography>
          <Autocomplete<Tag, true>
            multiple
            options={tags}
            getOptionLabel={(t) => t.name}
            value={tags.filter((t) => batchTagIds.includes(t.id))}
            onChange={(_, v) => setBatchTagIds(v.map((t) => t.id))}
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
              value.map((t, i) => {
                const tw = t as Tag & { tagType?: TagType };
                const icon = tw.tagType?.icon ? renderLucideIcon(tw.tagType.icon, { size: 12 }) : null;
                const label = tw.tagType?.name ? `${tw.tagType.name}: ${t.name}` : t.name;
                return (
                  <Chip
                    {...getTagProps({ index: i })}
                    key={t.id}
                    size="small"
                    icon={icon ? (icon as React.ReactElement) : undefined}
                    label={label}
                    sx={{
                      bgcolor: t.color ?? 'action.selected',
                      '& .MuiChip-label': { color: t.color ? 'rgba(0,0,0,0.7)' : 'inherit' },
                    }}
                  />
                );
              })
            }
            renderInput={(params) => <TextField {...params} label="添加标签" placeholder="选择标签" />}
          />
          <Autocomplete<Actor, true>
            multiple
            options={actors}
            getOptionLabel={(a) => a.name}
            value={actors.filter((a) => batchActorIds.includes(a.id))}
            onChange={(_, v) => setBatchActorIds(v.map((a) => a.id))}
            renderOption={(_, a) => (
              <EntityPreview entityType="actor" entity={a} inline />
            )}
            renderTags={(value, getTagProps) =>
              value.map((a, i) => (
                <Chip
                  {...getTagProps({ index: i })}
                  key={a.id}
                  size="small"
                  avatar={
                    a.avatarKey ? (
                      <Avatar src={getFileUrl('avatars', a.avatarKey)} alt="" />
                    ) : undefined
                  }
                  label={a.name}
                />
              ))
            }
            renderInput={(params) => <TextField {...params} label="添加演员" placeholder="选择演员" />}
          />
          <Autocomplete<Creator, true>
            multiple
            options={creators}
            getOptionLabel={(c) => c.name}
            value={creators.filter((c) => batchCreatorIds.includes(c.id))}
            onChange={(_, v) => setBatchCreatorIds(v.map((c) => c.id))}
            renderOption={(_, c) => (
              <EntityPreview entityType="creator" entity={c} inline />
            )}
            renderTags={(value, getTagProps) =>
              value.map((c, i) => (
                <Chip
                  {...getTagProps({ index: i })}
                  key={c.id}
                  size="small"
                  label={c.platform ? `${c.name} (${c.platform})` : c.name}
                />
              ))
            }
            renderInput={(params) => <TextField {...params} label="添加创作者" placeholder="选择创作者" />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleBatchApply}
            disabled={
              batchSubmitting ||
              (batchTagIds.length === 0 && batchActorIds.length === 0 && batchCreatorIds.length === 0)
            }
          >
            {batchSubmitting ? '处理中…' : '确定'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={indexStrategyFormOpen}
        onClose={handleCloseIndexStrategyForm}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingIndexStrategy ? '编辑索引策略' : '新建索引策略'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            select
            label="目录范围"
            value={indexStrategyFileDirId}
            onChange={(e) =>
              setIndexStrategyFileDirId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            fullWidth
          >
            <MenuItem value="all">全部目录</MenuItem>
            {fileDirs.map((dir) => (
              <MenuItem key={dir.id} value={dir.id}>
                {dir.path}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="文件 Key 正则"
            value={indexStrategyRegex}
            onChange={(e) => setIndexStrategyRegex(e.target.value)}
            placeholder="例如 ^tmp/|\\.part$"
            required
            fullWidth
            autoFocus
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={indexStrategyEnabled}
              onChange={(e) => setIndexStrategyEnabled(e.target.checked)}
            />
            <Typography>启用</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            模式固定为黑名单：匹配成功即跳过索引。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseIndexStrategyForm}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSubmitIndexStrategy}
            disabled={
              !indexStrategyRegex.trim() ||
              createIndexStrategyMut.isPending ||
              updateIndexStrategyMut.isPending
            }
          >
            {createIndexStrategyMut.isPending || updateIndexStrategyMut.isPending ? '处理中…' : '确定'}
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteConfirm
        open={!!indexStrategyDeleteTarget}
        message={
          indexStrategyDeleteTarget
            ? `确定要删除索引策略「${indexStrategyDeleteTarget.fileKeyRegex}」吗？`
            : ''
        }
        onClose={() => setIndexStrategyDeleteTarget(null)}
        onConfirm={handleDeleteIndexStrategyConfirm}
        loading={deleteIndexStrategyMut.isPending}
      />

      <VideoPreviewDialog
        open={!!previewVideoFileId}
        onClose={() => setPreviewVideoFileId(null)}
        videoFileId={previewVideoFileId}
      />
    </Box>
  );
}
