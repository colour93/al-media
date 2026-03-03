import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
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
  Chip,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Play,
  Plus,
  List,
  FolderTree,
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
  BrainCircuit,
  Repeat2,
  Copy,
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
  useVideoReencodeTask,
  useEnqueueVideoReencodeTask,
  useEnqueueAllVideoReencodeTasks,
  useDeleteVideoFile,
  useDeleteVideoFileReencodeSource,
  useVideoFileDuplicateGroups,
  useVideoFilesIncompatibleCount,
} from '../hooks/useVideoFiles';
import {
  useVideoInsertFromFile,
  useVideoInferTask,
  usePauseVideoInferTask,
  useResumeVideoInferTask,
} from '../hooks/useVideos';
import { batchAddTagsToVideos, batchAddActorsToVideos, batchAddCreatorsToVideos } from '../api/videos';
import { useActorCreate, useActorsList } from '../hooks/useActors';
import { useCreatorCreate, useCreatorsList } from '../hooks/useCreators';
import { useTagsList } from '../hooks/useTags';
import { fetchActorsList, searchActors } from '../api/actors';
import { fetchCreatorsList, searchCreators } from '../api/creators';
import { fetchTagsList, searchTags } from '../api/tags';
import { useFileDirsList } from '../hooks/useFileDirs';
import { getFileUrl } from '../api/file';
import { renderLucideIcon } from '../utils/lucideIcons';
import { getTagChipSx } from '../utils/tagChipSx';
import { formatDurationHuman } from '../utils/format';
import { useQueryClient } from '@tanstack/react-query';
import { validateListSearch } from '../schemas/listSearch';
import { EntityCreateAutocomplete } from '../components/EntityCreateAutocomplete/EntityCreateAutocomplete';
import type { VideoFile } from '../api/types';
import type { Actor } from '../api/types';
import type { Creator } from '../api/types';
import type {
  FileDir,
  Tag,
  TagType,
  VideoFileDuplicateGroup,
  VideoFileIndexStrategy,
} from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import {
  fetchVideoFile,
  fetchVideoFileFolderChildren,
  fetchVideoFilesByFolder,
  type VideoFileHasVideoFilter,
  type VideoFileWebCompatibilityFilter,
} from '../api/videoFiles';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FolderNode = {
  fileDirId: number;
  path: string;
  name: string;
  isRoot?: boolean;
};

type CursorChunk<T> = {
  items: T[];
  nextCursor: string | null;
  loading: boolean;
  loaded: boolean;
};

type FolderViewRow =
  | { type: 'folder'; key: string; depth: number; node: FolderNode }
  | { type: 'file'; key: string; depth: number; file: VideoFile }
  | { type: 'load-more-folders'; key: string; depth: number; node: FolderNode }
  | { type: 'load-more-files'; key: string; depth: number; node: FolderNode };

const FOLDER_VIEW_PAGE_SIZE = 50;
const ENTITY_SELECTOR_PAGE_SIZE = 20;
const FOLDER_ROW_HEIGHT = 52;
const FOLDER_OVERSCAN = 8;

function buildFolderKey(fileDirId: number, folderPath: string): string {
  return `${fileDirId}:${folderPath}`;
}

function mergeById<T extends { id: number }>(base: T[], extra: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of [...base, ...extra]) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function createEmptyCursorChunk<T>(): CursorChunk<T> {
  return {
    items: [],
    nextCursor: null,
    loading: false,
    loaded: false,
  };
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

function formatInferTaskStatus(status?: string): string {
  if (status === 'processing') return '进行中';
  if (status === 'paused') return '已暂停';
  return '空闲';
}

function formatReencodeTaskStatus(status?: string): string {
  if (status === 'processing') return '进行中';
  return '空闲';
}

function getWebCompatibilityHint(file: VideoFile): string | null {
  if (file.webCompatible !== false) return null;
  if (file.webCompatibilityHint) {
    return file.webCompatibilityHint;
  }
  const issues = file.webCompatibilityIssues ?? [];
  if (issues.length > 0) {
    return issues[0] ?? null;
  }
  return '该文件可能不能正常在 Web 端播放';
}

function validateVideoFilesSearch(
  search: Record<string, unknown>
): ReturnType<typeof validateListSearch> & {
  webCompatibility: VideoFileWebCompatibilityFilter;
  hasVideo: VideoFileHasVideoFilter;
  fileDirId?: number;
} {
  const base = validateListSearch(search);
  const rawCompatibility = search?.webCompatibility;
  const rawHasVideo = search?.hasVideo;
  const rawFileDirId = search?.fileDirId;
  const webCompatibility: VideoFileWebCompatibilityFilter =
    rawCompatibility === 'compatible' || rawCompatibility === 'incompatible' ? rawCompatibility : 'all';
  const hasVideo: VideoFileHasVideoFilter =
    rawHasVideo === 'bound' || rawHasVideo === 'unbound' ? rawHasVideo : 'all';
  const parsedFileDirId =
    typeof rawFileDirId === 'number'
      ? rawFileDirId
      : typeof rawFileDirId === 'string'
        ? Number(rawFileDirId)
        : NaN;
  const fileDirId =
    Number.isInteger(parsedFileDirId) && parsedFileDirId >= 1 ? parsedFileDirId : undefined;
  return { ...base, webCompatibility, hasVideo, fileDirId };
}

function FolderLazyView(props: {
  enabledFileDirs: FileDir[];
  selectedFileIds: Set<number>;
  onToggleFileSelect: (id: number) => void;
  onCreateVideo: (row: VideoFile) => void;
  onGoToVideoEdit: (videoId: number) => void;
  onPreviewVideoFile: (videoFileId: number) => void;
  onEnqueueReencode: (videoFileId: number) => void;
  onDeleteVideoFile: (row: VideoFile) => void;
  onDeleteReencodeSource: (row: VideoFile) => void;
  createVideoLoading: boolean;
  reencodeSubmitting: boolean;
  deleteFileSubmitting: boolean;
  deleteReencodeSourceSubmitting: boolean;
}) {
  const {
    enabledFileDirs,
    selectedFileIds,
    onToggleFileSelect,
    onCreateVideo,
    onGoToVideoEdit,
    onPreviewVideoFile,
    onEnqueueReencode,
    onDeleteVideoFile,
    onDeleteReencodeSource,
    createVideoLoading,
    reencodeSubmitting,
    deleteFileSubmitting,
    deleteReencodeSourceSubmitting,
  } = props;

  const rootNodes = useMemo<FolderNode[]>(
    () =>
      enabledFileDirs.map((dir) => ({
        fileDirId: dir.id,
        path: '',
        name: dir.path,
        isRoot: true,
      })),
    [enabledFileDirs]
  );

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderChildrenMap, setFolderChildrenMap] = useState<Record<string, CursorChunk<FolderNode>>>({});
  const [folderFilesMap, setFolderFilesMap] = useState<Record<string, CursorChunk<VideoFile>>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadMoreChildren = useCallback(async (node: FolderNode) => {
    const key = buildFolderKey(node.fileDirId, node.path);
    const current = folderChildrenMap[key] ?? createEmptyCursorChunk<FolderNode>();
    if (current.loading) return;
    if (current.loaded && !current.nextCursor) return;
    const cursor = current.nextCursor ?? undefined;

    setFolderChildrenMap((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? current),
        loading: true,
      },
    }));

    try {
      const res = await fetchVideoFileFolderChildren({
        fileDirId: node.fileDirId,
        folderPath: node.path || undefined,
        cursor,
        pageSize: FOLDER_VIEW_PAGE_SIZE,
      });
      setFolderChildrenMap((prev) => {
        const current = prev[key] ?? createEmptyCursorChunk<FolderNode>();
        const merged = [...current.items, ...res.items.map((it) => ({ ...it, isRoot: false }))];
        const dedupMap = new Map(merged.map((it) => [it.path, it]));
        const nextCursor =
          res.nextCursor && res.nextCursor !== (cursor ?? null) ? res.nextCursor : null;
        return {
          ...prev,
          [key]: {
            items: Array.from(dedupMap.values()),
            nextCursor,
            loaded: true,
            loading: false,
          },
        };
      });
    } catch {
      setFolderChildrenMap((prev) => {
        const current = prev[key] ?? createEmptyCursorChunk<FolderNode>();
        return {
          ...prev,
          [key]: {
            ...current,
            nextCursor: null,
            loaded: true,
            loading: false,
          },
        };
      });
    }
  }, [folderChildrenMap]);

  const loadMoreFiles = useCallback(async (node: FolderNode) => {
    const key = buildFolderKey(node.fileDirId, node.path);
    const current = folderFilesMap[key] ?? createEmptyCursorChunk<VideoFile>();
    if (current.loading) return;
    if (current.loaded && !current.nextCursor) return;
    const cursor = current.nextCursor ?? undefined;

    setFolderFilesMap((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? current),
        loading: true,
      },
    }));

    try {
      const res = await fetchVideoFilesByFolder({
        fileDirId: node.fileDirId,
        folderPath: node.path || undefined,
        cursor,
        pageSize: FOLDER_VIEW_PAGE_SIZE,
      });
      setFolderFilesMap((prev) => {
        const current = prev[key] ?? createEmptyCursorChunk<VideoFile>();
        const merged = [...current.items, ...res.items];
        const dedupMap = new Map(merged.map((it) => [it.id, it]));
        const nextCursor =
          res.nextCursor && res.nextCursor !== (cursor ?? null) ? res.nextCursor : null;
        return {
          ...prev,
          [key]: {
            items: Array.from(dedupMap.values()),
            nextCursor,
            loaded: true,
            loading: false,
          },
        };
      });
    } catch {
      setFolderFilesMap((prev) => {
        const current = prev[key] ?? createEmptyCursorChunk<VideoFile>();
        return {
          ...prev,
          [key]: {
            ...current,
            nextCursor: null,
            loaded: true,
            loading: false,
          },
        };
      });
    }
  }, [folderFilesMap]);

  const toggleExpandFolder = useCallback(
    (node: FolderNode) => {
      const key = buildFolderKey(node.fileDirId, node.path);
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      void loadMoreChildren(node);
      void loadMoreFiles(node);
    },
    [loadMoreChildren, loadMoreFiles]
  );

  const rows = useMemo(() => {
    const result: FolderViewRow[] = [];
    const append = (node: FolderNode, depth: number) => {
      const key = buildFolderKey(node.fileDirId, node.path);
      result.push({ type: 'folder', key: `folder:${key}`, depth, node });
      if (!expandedFolders.has(key)) return;

      const childChunk = folderChildrenMap[key] ?? createEmptyCursorChunk<FolderNode>();
      for (const child of childChunk.items) {
        append(child, depth + 1);
      }
      if (childChunk.loading || childChunk.nextCursor) {
        result.push({ type: 'load-more-folders', key: `load-folders:${key}`, depth: depth + 1, node });
      }

      const fileChunk = folderFilesMap[key] ?? createEmptyCursorChunk<VideoFile>();
      for (const file of fileChunk.items) {
        result.push({
          type: 'file',
          key: `file:${file.id}`,
          depth: depth + 1,
          file,
        });
      }
      if (fileChunk.loading || fileChunk.nextCursor) {
        result.push({ type: 'load-more-files', key: `load-files:${key}`, depth: depth + 1, node });
      }
    };

    for (const root of rootNodes) {
      append(root, 0);
    }

    return result;
  }, [expandedFolders, folderChildrenMap, folderFilesMap, rootNodes]);

  const totalHeight = rows.length * FOLDER_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / FOLDER_ROW_HEIGHT) - FOLDER_OVERSCAN);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / FOLDER_ROW_HEIGHT) + FOLDER_OVERSCAN
  );
  const visibleRows = rows.slice(startIndex, endIndex);

  useEffect(() => {
    const folderLoadMap = new Map<string, FolderNode>();
    const fileLoadMap = new Map<string, FolderNode>();
    for (const row of visibleRows) {
      if (row.type === 'load-more-folders') {
        folderLoadMap.set(buildFolderKey(row.node.fileDirId, row.node.path), row.node);
      }
      if (row.type === 'load-more-files') {
        fileLoadMap.set(buildFolderKey(row.node.fileDirId, row.node.path), row.node);
      }
    }
    if (folderLoadMap.size === 0 && fileLoadMap.size === 0) {
      return;
    }
    queueMicrotask(() => {
      for (const node of folderLoadMap.values()) {
        void loadMoreChildren(node);
      }
      for (const node of fileLoadMap.values()) {
        void loadMoreFiles(node);
      }
    });
  }, [visibleRows, loadMoreChildren, loadMoreFiles]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight || 520);
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Box
        ref={scrollRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        sx={{ height: 'calc(100vh - 360px)', overflow: 'auto', position: 'relative' }}
      >
        <Box sx={{ height: totalHeight || FOLDER_ROW_HEIGHT, position: 'relative' }}>
          {visibleRows.map((row, index) => {
            const absoluteIndex = startIndex + index;
            const top = absoluteIndex * FOLDER_ROW_HEIGHT;

            if (row.type === 'folder') {
              const key = buildFolderKey(row.node.fileDirId, row.node.path);
              const isExpanded = expandedFolders.has(key);
              return (
                <Box
                  key={row.key}
                  sx={{
                    position: 'absolute',
                    top,
                    left: 0,
                    right: 0,
                    height: FOLDER_ROW_HEIGHT,
                    px: 1,
                    pl: row.depth * 2 + 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => toggleExpandFolder(row.node)}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <FolderTree size={16} />
                  <Typography
                    variant="body2"
                    title={row.node.isRoot ? row.node.name : row.node.path}
                    sx={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.node.isRoot ? row.node.name : row.node.name}
                  </Typography>
                </Box>
              );
            }

            if (row.type === 'file') {
              const fileName = row.file.fileKey.split(/[\\/]/).pop() ?? row.file.fileKey;
              return (
                <Box
                  key={row.key}
                  sx={{
                    position: 'absolute',
                    top,
                    left: 0,
                    right: 0,
                    height: FOLDER_ROW_HEIGHT,
                    px: 1,
                    pl: row.depth * 2 + 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={selectedFileIds.has(row.file.id)}
                    onChange={() => onToggleFileSelect(row.file.id)}
                  />
                  <Typography
                    variant="body2"
                    title={row.file.fileKey}
                    sx={{
                      minWidth: 0,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDurationHuman(row.file.videoDuration)} · {formatSize(row.file.fileSize)}
                  </Typography>
                  {!row.file.webCompatible && (
                    <Chip size="small" color="warning" label="Web 兼容性风险" />
                  )}
                  <Button
                    size="small"
                    startIcon={<Play size={14} />}
                    onClick={() => onPreviewVideoFile(row.file.id)}
                  >
                    预览
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Repeat2 size={14} />}
                    onClick={() => onEnqueueReencode(row.file.id)}
                    disabled={reencodeSubmitting}
                  >
                    重编码
                  </Button>
                  {row.file.sourceVideoFileId ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<Trash2 size={14} />}
                      onClick={() => onDeleteReencodeSource(row.file)}
                      disabled={deleteReencodeSourceSubmitting}
                    >
                      删源文件
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Trash2 size={14} />}
                    onClick={() => onDeleteVideoFile(row.file)}
                    disabled={deleteFileSubmitting}
                  >
                    删除文件
                  </Button>
                  {row.file.video ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Pencil size={14} />}
                      onClick={() => onGoToVideoEdit(row.file.video!.id)}
                    >
                      编辑视频
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Plus size={14} />}
                      onClick={() => onCreateVideo(row.file)}
                      disabled={createVideoLoading}
                    >
                      新建视频
                    </Button>
                  )}
                </Box>
              );
            }

            return (
              <Box
                key={row.key}
                sx={{
                  position: 'absolute',
                  top,
                  left: 0,
                  right: 0,
                  height: FOLDER_ROW_HEIGHT,
                  px: 1,
                  pl: row.depth * 2 + 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  color: 'text.secondary',
                }}
              >
                <CircularProgress size={14} />
                <Typography variant="caption">加载中…</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export const Route = createFileRoute('/video-files')({
  validateSearch: validateVideoFilesSearch,
  component: VideoFilesPage,
});

function VideoFilesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, pageSize, keyword, sortBy, sortOrder, webCompatibility, hasVideo, fileDirId } = Route.useSearch();
  const queryClient = useQueryClient();

  const { data, isLoading } = useVideoFilesList(
    page,
    pageSize,
    keyword,
    { webCompatibility, hasVideo, fileDirId },
    sortBy,
    sortOrder
  );
  const { data: fileDirsData } = useFileDirsList(1, 100, '');
  const { data: scanTask } = useVideoFileScanTask();
  const { data: reencodeTask } = useVideoReencodeTask();
  const enqueueReencodeMut = useEnqueueVideoReencodeTask();
  const enqueueAllReencodeMut = useEnqueueAllVideoReencodeTasks();
  const deleteFileMut = useDeleteVideoFile();
  const deleteReencodeSourceMut = useDeleteVideoFileReencodeSource();
  const { data: inferTask } = useVideoInferTask();
  const pauseInferTaskMut = usePauseVideoInferTask();
  const resumeInferTaskMut = useResumeVideoInferTask();
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
  const actorCreateMut = useActorCreate();
  const creatorCreateMut = useCreatorCreate();
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
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [duplicatesPage, setDuplicatesPage] = useState(1);
  const duplicatesPageSize = 20;
  const [deleteFileTarget, setDeleteFileTarget] = useState<VideoFile | null>(null);
  const [deleteReencodeSourceTarget, setDeleteReencodeSourceTarget] = useState<VideoFile | null>(null);
  const [reencodeAllDeleteConfirmOpen, setReencodeAllDeleteConfirmOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTagIds, setBatchTagIds] = useState<number[]>([]);
  const [batchActorIds, setBatchActorIds] = useState<number[]>([]);
  const [batchCreatorIds, setBatchCreatorIds] = useState<number[]>([]);
  const [batchAdditionalActors, setBatchAdditionalActors] = useState<Actor[]>([]);
  const [batchAdditionalCreators, setBatchAdditionalCreators] = useState<Creator[]>([]);
  const [batchAdditionalTags, setBatchAdditionalTags] = useState<(Tag & { tagType?: TagType })[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [scanFileDirId, setScanFileDirId] = useState<number | ''>('');
  const [indexStrategyFormOpen, setIndexStrategyFormOpen] = useState(false);
  const [editingIndexStrategy, setEditingIndexStrategy] = useState<VideoFileIndexStrategy | null>(null);
  const [indexStrategyDeleteTarget, setIndexStrategyDeleteTarget] = useState<VideoFileIndexStrategy | null>(null);
  const [indexStrategyFileDirId, setIndexStrategyFileDirId] = useState<number | 'all'>('all');
  const [indexStrategyRegex, setIndexStrategyRegex] = useState('');
  const [indexStrategyEnabled, setIndexStrategyEnabled] = useState(true);
  const lastReencodeFinishedRef = useRef<string | null>(null);

  const items = useMemo(() => (data?.items ?? []) as VideoFile[], [data?.items]);
  const total = data?.total ?? 0;
  const { data: incompatibleSummaryData } = useVideoFilesIncompatibleCount(
    keyword,
    { hasVideo, fileDirId },
    sortBy,
    sortOrder,
    webCompatibility === 'all'
  );
  const incompatibleCount = useMemo(() => {
    if (webCompatibility === 'compatible') return 0;
    if (webCompatibility === 'incompatible') return total;
    return incompatibleSummaryData?.total ?? 0;
  }, [incompatibleSummaryData?.total, total, webCompatibility]);
  const { data: duplicateGroupsData, isLoading: duplicateGroupsLoading } =
    useVideoFileDuplicateGroups(duplicatesPage, duplicatesPageSize, duplicatesOpen);
  const duplicateGroups = (duplicateGroupsData?.items ?? []) as VideoFileDuplicateGroup[];
  const duplicateTotal = duplicateGroupsData?.total ?? 0;
  const duplicateTotalPages = Math.max(1, Math.ceil(duplicateTotal / duplicatesPageSize));
  const fileDirs = useMemo(() => (fileDirsData?.items ?? []) as FileDir[], [fileDirsData?.items]);
  const enabledFileDirs = useMemo(() => fileDirs.filter((dir) => dir.enabled), [fileDirs]);
  const actors = useMemo(
    () => mergeById((actorsData?.items ?? []) as Actor[], batchAdditionalActors),
    [actorsData?.items, batchAdditionalActors]
  );
  const creators = useMemo(
    () => mergeById((creatorsData?.items ?? []) as Creator[], batchAdditionalCreators),
    [batchAdditionalCreators, creatorsData?.items]
  );
  const tags = useMemo(
    () =>
      mergeById(
        (tagsData?.items ?? []) as (Tag & { tagType?: TagType })[],
        batchAdditionalTags
      ),
    [batchAdditionalTags, tagsData?.items]
  );
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

  useEffect(() => {
    const finishedAt = reencodeTask?.lastFinishedAt ?? null;
    if (!finishedAt) return;
    if (lastReencodeFinishedRef.current === finishedAt) return;
    lastReencodeFinishedRef.current = finishedAt;
    queryClient.invalidateQueries({ queryKey: ['videoFiles'] });
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient, reencodeTask?.lastFinishedAt]);

  const toggleFileSelect = (id: number) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      const selectedItems = (
        await Promise.all(
          Array.from(selectedFileIds).map(async (id) => {
            const cached = itemMap.get(id);
            if (cached) return cached;
            try {
              return await fetchVideoFile(id);
            } catch {
              return null;
            }
          })
        )
      ).filter((f): f is VideoFile => !!f);

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
      setBatchAdditionalActors([]);
      setBatchAdditionalCreators([]);
      setBatchAdditionalTags([]);
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
  const inferTaskPaused = inferTask?.status === 'paused';
  const inferTaskMutating = pauseInferTaskMut.isPending || resumeInferTaskMut.isPending;
  const reencodeTaskProcessing = reencodeTask?.status === 'processing';

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

  const handleEnqueueReencode = async (videoFileId: number) => {
    await enqueueReencodeMut.mutateAsync(videoFileId);
    queryClient.invalidateQueries({ queryKey: ['videoFiles'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleRunGlobalDuplicateCheck = () => {
    setDuplicatesOpen(true);
    setDuplicatesPage(1);
  };

  const handleViewDuplicateInTable = (uniqueId: string) => {
    const keywordValue = uniqueId.trim();
    setViewMode('table');
    setSearchDraft(keywordValue);
    navigate({
      search: (prev) => ({
        ...prev,
        keyword: keywordValue,
        page: 1,
      }),
    });
  };

  const handleEnqueueAllReencodeAndDeleteSource = async () => {
    await enqueueAllReencodeMut.mutateAsync({ deleteSourceAfterSuccess: true });
    setReencodeAllDeleteConfirmOpen(false);
  };

  const handleDeleteVideoFileConfirm = async () => {
    if (!deleteFileTarget) return;
    await deleteFileMut.mutateAsync(deleteFileTarget.id);
    setDeleteFileTarget(null);
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteFileTarget.id);
      return next;
    });
  };

  const handleDeleteReencodeSourceConfirm = async () => {
    if (!deleteReencodeSourceTarget) return;
    await deleteReencodeSourceMut.mutateAsync(deleteReencodeSourceTarget.id);
    setDeleteReencodeSourceTarget(null);
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (deleteReencodeSourceTarget.sourceVideoFileId) {
        next.delete(deleteReencodeSourceTarget.sourceVideoFileId);
      }
      return next;
    });
  };

  const handleDeleteLastReencodeSource = async () => {
    const outputVideoFileId = reencodeTask?.lastOutputVideoFileId;
    if (!outputVideoFileId) return;
    const cached = itemMap.get(outputVideoFileId);
    if (cached) {
      setDeleteReencodeSourceTarget(cached);
      return;
    }
    try {
      const latestOutput = await fetchVideoFile(outputVideoFileId);
      setDeleteReencodeSourceTarget(latestOutput);
    } catch {
      /* 错误由全局 API 错误处理 */
    }
  };

  const handleDeleteIndexStrategyConfirm = async () => {
    if (!indexStrategyDeleteTarget) return;
    await deleteIndexStrategyMut.mutateAsync(indexStrategyDeleteTarget.id);
    setIndexStrategyDeleteTarget(null);
  };

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
    { id: 'fileKey', label: '文件', width: 280, render: (r) => r.fileKey, sortable: true, sortKey: 'fileKey' },
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
    {
      id: 'webCompatible',
      label: 'Web 兼容',
      width: 160,
      render: (r) =>
        r.webCompatible === false ? (
          <Chip
            size="small"
            color="warning"
            label={getWebCompatibilityHint(r) ?? '可能无法播放'}
          />
        ) : (
          <Chip size="small" color="success" label="兼容" />
        ),
    },
    { id: 'uniqueId', label: '唯一ID', render: (r) => r.uniqueId },
    {
      id: 'sourceVideoFile',
      label: '转码源',
      width: 280,
      render: (r) =>
        r.sourceVideoFile ? `#${r.sourceVideoFile.id} · ${r.sourceVideoFile.fileKey}` : '-',
    },
    {
      id: 'video',
      label: '关联视频',
      width: 180,
      render: (r) =>
        r.video ? (
          <Button
            size="small"
            variant="text"
            sx={{ p: 0, minWidth: 0, textTransform: 'none', justifyContent: 'flex-start' }}
            onClick={() => handleGoToVideoEdit(r.video!.id)}
          >
            <EntityPreview entityType="video" entity={r.video} inline />
          </Button>
        ) : (
          '-'
        ),
    },
  ];

  const handleGoToVideoEdit = (videoId: number) => {
    navigate({
      to: '/videos',
      search: { page: 1, pageSize: 10, keyword: '', editId: videoId },
    });
  };

  const handleCreateVideo = async (row: VideoFile) => {
    const video = await insertMut.mutateAsync({
      videoFileId: row.id,
    });
    handleGoToVideoEdit(video.id);
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
      <Button
        size="small"
        variant="outlined"
        startIcon={<Repeat2 size={14} />}
        onClick={() => handleEnqueueReencode(row.id)}
        disabled={enqueueReencodeMut.isPending}
      >
        重编码
      </Button>
      {row.sourceVideoFileId ? (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={<Trash2 size={14} />}
          onClick={() => setDeleteReencodeSourceTarget(row)}
          disabled={deleteReencodeSourceMut.isPending}
        >
          删源文件
        </Button>
      ) : null}
      <Button
        size="small"
        variant="outlined"
        color="error"
        startIcon={<Trash2 size={14} />}
        onClick={() => setDeleteFileTarget(row)}
        disabled={deleteFileMut.isPending}
      >
        删除文件
      </Button>
      {row.video ? (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Pencil size={14} />}
          onClick={() => handleGoToVideoEdit(row.video!.id)}
        >
          编辑视频
        </Button>
      ) : (
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
            startIcon={<Copy size={18} />}
            onClick={handleRunGlobalDuplicateCheck}
          >
            一键全局查重
          </Button>
          <Button
            variant="outlined"
            startIcon={<Tags size={18} />}
            disabled={selectedFileIds.size === 0}
            onClick={() => {
              setBatchAdditionalActors([]);
              setBatchAdditionalCreators([]);
              setBatchAdditionalTags([]);
              setBatchOpen(true);
            }}
          >
            批量设置 ({selectedFileIds.size})
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        视频文件由目录扫描自动生成。可多选文件或整文件夹，批量设置标签、演员、创作者（无视频实体时会先新建）。
      </Typography>
      {incompatibleCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          当前列表中有 {incompatibleCount} 个文件可能不适合 Web 直接播放，建议执行重编码。
        </Alert>
      )}

      {duplicatesOpen && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 2 }}>
            <Box>
              <Typography variant="h6">全局重复视频（按 uniqueId）</Typography>
              <Typography variant="body2" color="text.secondary">
                自动查找 `video_files` 中 `uniqueId` 重复的数据，并按重复数降序展示。
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setDuplicatesPage(1);
                queryClient.invalidateQueries({ queryKey: ['videoFiles', 'duplicateGroups'] });
              }}
              disabled={duplicateGroupsLoading}
            >
              刷新
            </Button>
          </Box>
          {duplicateGroupsLoading ? (
            <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                正在生成重复列表...
              </Typography>
            </Box>
          ) : duplicateGroups.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              未发现重复视频文件。
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {duplicateGroups.map((group) => (
                <Box
                  key={group.uniqueId}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1.25,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1,
                      mb: 0.75,
                    }}
                  >
                    <Typography variant="body2">
                      <strong>{group.uniqueId}</strong> · 重复文件数 {group.fileCount}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => handleViewDuplicateInTable(group.uniqueId)}
                    >
                      在主表中查看
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {group.files.map((file) => (
                      <Typography key={file.id} variant="caption" color="text.secondary">
                        #{file.id} · {file.fileKey}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  第 {duplicatesPage} / {duplicateTotalPages} 页 · 共 {duplicateTotal} 组
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    disabled={duplicatesPage <= 1}
                    onClick={() => setDuplicatesPage((prev) => Math.max(1, prev - 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    size="small"
                    disabled={duplicatesPage >= duplicateTotalPages}
                    onClick={() => setDuplicatesPage((prev) => Math.min(duplicateTotalPages, prev + 1))}
                  >
                    下一页
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Paper>
      )}

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
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BrainCircuit size={18} />
              视频信息推理任务
              </Typography>
            <Typography variant="body2" color="text.secondary">
              状态：{formatInferTaskStatus(inferTask?.status)}
              {inferTask?.current?.source ? ` · 类型：${formatInferSource(inferTask.current.source)}` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              排队：{inferTask?.waitingCount ?? 0}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={inferTaskPaused ? <Play size={14} /> : <Pause size={14} />}
              onClick={() => (inferTaskPaused ? resumeInferTaskMut.mutate() : pauseInferTaskMut.mutate())}
              disabled={inferTaskMutating || (!inferTaskProcessing && !inferTaskPaused)}
            >
              {inferTaskPaused ? '继续' : '暂停'}
            </Button>
          </Box>
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Repeat2 size={18} />
              视频重编码任务
            </Typography>
            <Typography variant="body2" color="text.secondary">
              状态：{formatReencodeTaskStatus(reencodeTask?.status)}
              {reencodeTask?.current?.sourceFileKey ? ` · 当前：${reencodeTask.current.sourceFileKey}` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              排队：{reencodeTask?.waitingCount ?? 0}
            </Typography>
            <Chip
              size="small"
              color={reencodeTaskProcessing ? 'warning' : 'default'}
              label={formatReencodeTaskStatus(reencodeTask?.status)}
            />
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<Repeat2 size={14} />}
              onClick={() => setReencodeAllDeleteConfirmOpen(true)}
              disabled={enqueueAllReencodeMut.isPending}
            >
              重编码兼容风险并删源
            </Button>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<Trash2 size={14} />}
              onClick={handleDeleteLastReencodeSource}
              disabled={!reencodeTask?.lastOutputVideoFileId || deleteReencodeSourceMut.isPending}
            >
              一键删最近源文件
            </Button>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {reencodeTask?.current?.outputFileKey
            ? `输出：${reencodeTask.current.outputFileKey}`
            : reencodeTask?.lastOutputFileKey
              ? `最近输出：${reencodeTask.lastOutputFileKey}`
              : '可在文件行操作中点击“重编码”加入队列'}
          {reencodeTask?.lastSourceFileKey ? ` · 最近源文件：${reencodeTask.lastSourceFileKey}` : ''}
          {reencodeTask?.lastError ? ` · 最近错误：${reencodeTask.lastError}` : ''}
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            文件夹视图按层级懒加载：先拉文件夹，展开后再按需拉取该目录下文件，滚动自动加载更多。
          </Typography>
          <FolderLazyView
            enabledFileDirs={enabledFileDirs}
            selectedFileIds={selectedFileIds}
            onToggleFileSelect={toggleFileSelect}
            onCreateVideo={handleCreateVideo}
            onGoToVideoEdit={handleGoToVideoEdit}
            onPreviewVideoFile={(videoFileId) => setPreviewVideoFileId(videoFileId)}
            onEnqueueReencode={handleEnqueueReencode}
            onDeleteVideoFile={(row) => setDeleteFileTarget(row)}
            onDeleteReencodeSource={(row) => setDeleteReencodeSourceTarget(row)}
            createVideoLoading={insertMut.isPending}
            reencodeSubmitting={enqueueReencodeMut.isPending}
            deleteFileSubmitting={deleteFileMut.isPending}
            deleteReencodeSourceSubmitting={deleteReencodeSourceMut.isPending}
          />
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
          searchPlaceholder="搜索文件 / 唯一ID / 目录 / ID（如 123、#123）…"
          searchValue={searchDraft}
          onSearchChange={setSearchDraft}
          onSearch={(k) => navigate({ search: (prev) => ({ ...prev, keyword: k, page: 1 }) })}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(by, order) =>
            navigate({ search: (prev) => ({ ...prev, sortBy: by, sortOrder: order, page: 1 }) })
          }
          columnFilters={{
            fileKey: (
              <TextField
                select
                size="small"
                label="目录"
                value={fileDirId ?? ''}
                onChange={(e) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      fileDirId: e.target.value === '' ? undefined : Number(e.target.value),
                      page: 1,
                    }),
                  })
                }
                fullWidth
              >
                <MenuItem value="">全部目录</MenuItem>
                {fileDirs.map((dir) => (
                  <MenuItem key={dir.id} value={dir.id}>
                    {dir.path}
                  </MenuItem>
                ))}
              </TextField>
            ),
            video: (
              <TextField
                select
                size="small"
                label="关联状态"
                value={hasVideo}
                onChange={(e) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      hasVideo: e.target.value as VideoFileHasVideoFilter,
                      page: 1,
                    }),
                  })
                }
                fullWidth
              >
                <MenuItem value="all">全部</MenuItem>
                <MenuItem value="bound">已关联视频</MenuItem>
                <MenuItem value="unbound">未关联视频</MenuItem>
              </TextField>
            ),
            webCompatible: (
              <TextField
                select
                size="small"
                label="Web 兼容性"
                value={webCompatibility}
                onChange={(e) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      webCompatibility: e.target.value as VideoFileWebCompatibilityFilter,
                      page: 1,
                    }),
                  })
                }
                fullWidth
              >
                <MenuItem value="all">全部文件</MenuItem>
                <MenuItem value="incompatible">仅兼容性风险</MenuItem>
                <MenuItem value="compatible">仅兼容文件</MenuItem>
              </TextField>
            ),
          }}
          actionsFilter={
            <Button
              size="small"
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    webCompatibility: 'all',
                    hasVideo: 'all',
                    fileDirId: undefined,
                    page: 1,
                  }),
                })
              }
            >
              重置筛选
            </Button>
          }
          actions={actionsColumn}
          emptyMessage="暂无视频文件"
        />
      )}

      <Dialog
        open={batchOpen}
        onClose={() => {
          setBatchOpen(false);
          setBatchAdditionalActors([]);
          setBatchAdditionalCreators([]);
          setBatchAdditionalTags([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>批量设置</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            已选 {selectedFileIds.size} 个视频文件。无关联视频的文件将先新建视频再应用设置。
          </Typography>
          <EntityCreateAutocomplete<Tag & { tagType?: TagType }>
            label="添加标签"
            placeholder="搜索并选择标签"
            options={tags}
            value={tags.filter((t) => batchTagIds.includes(t.id)) as (Tag & { tagType?: TagType })[]}
            onChange={setBatchTagIds}
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
                    sx={getTagChipSx(t.color)}
                  />
                );
              })
            }
          />
          <EntityCreateAutocomplete<Actor>
            label="添加演员"
            placeholder="搜索演员，不存在可直接新建"
            options={actors}
            value={actors.filter((a) => batchActorIds.includes(a.id))}
            onChange={setBatchActorIds}
            pageSize={ENTITY_SELECTOR_PAGE_SIZE}
            loadOptions={({ keyword, page, pageSize }) =>
              keyword.trim()
                ? searchActors(keyword.trim(), page, pageSize)
                : fetchActorsList(page, pageSize)
            }
            getOptionLabel={(a) => a.name}
            renderOption={(_, a) => <EntityPreview entityType="actor" entity={a} inline />}
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
            onCreate={async (name) => actorCreateMut.mutateAsync({ name })}
            onCreated={(entity) => setBatchAdditionalActors((prev) => mergeById(prev, [entity]))}
          />
          <EntityCreateAutocomplete<Creator>
            label="添加创作者"
            placeholder="搜索创作者，不存在可直接新建"
            options={creators}
            value={creators.filter((c) => batchCreatorIds.includes(c.id))}
            onChange={setBatchCreatorIds}
            pageSize={ENTITY_SELECTOR_PAGE_SIZE}
            loadOptions={({ keyword, page, pageSize }) =>
              keyword.trim()
                ? searchCreators(keyword.trim(), page, pageSize)
                : fetchCreatorsList(page, pageSize)
            }
            getOptionLabel={(c) => c.name}
            renderOption={(_, c) => <EntityPreview entityType="creator" entity={c} inline />}
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
            onCreate={async (name) => creatorCreateMut.mutateAsync({ name, type: 'person' })}
            onCreated={(entity) => setBatchAdditionalCreators((prev) => mergeById(prev, [entity]))}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBatchOpen(false);
              setBatchAdditionalActors([]);
              setBatchAdditionalCreators([]);
              setBatchAdditionalTags([]);
            }}
          >
            取消
          </Button>
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
            placeholder="例如 /nightalks\\.com/i 或 ^tmp/|\\.part$"
            helperText="支持 JS 正则字面量写法（/pattern/flags）"
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
        open={!!deleteFileTarget}
        message={
          deleteFileTarget
            ? `确定要删除文件「${deleteFileTarget.fileKey}」吗？将同时删除真实文件和索引记录。`
            : ''
        }
        onClose={() => setDeleteFileTarget(null)}
        onConfirm={handleDeleteVideoFileConfirm}
        loading={deleteFileMut.isPending}
      />

      <DeleteConfirm
        open={!!deleteReencodeSourceTarget}
        message={
          deleteReencodeSourceTarget
            ? `确定要删除源文件「${deleteReencodeSourceTarget.sourceVideoFile?.fileKey ?? `#${deleteReencodeSourceTarget.sourceVideoFileId}` }」吗？`
            : ''
        }
        onClose={() => setDeleteReencodeSourceTarget(null)}
        onConfirm={handleDeleteReencodeSourceConfirm}
        loading={deleteReencodeSourceMut.isPending}
      />

      <DeleteConfirm
        open={reencodeAllDeleteConfirmOpen}
        message="确定要将全部 Web 兼容风险文件加入重编码队列并在完成后删除源文件吗？为避免重复转码，已自动排除已有 sourceVideoFileId 的输出文件。"
        onClose={() => setReencodeAllDeleteConfirmOpen(false)}
        onConfirm={handleEnqueueAllReencodeAndDeleteSource}
        loading={enqueueAllReencodeMut.isPending}
      />

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
