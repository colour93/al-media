import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ChevronDown, ChevronRight, FolderTree, List, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { DataTable, type DataTableColumn } from '../components/DataTable/DataTable';
import { FormDialog } from '../components/FormDialog/FormDialog';
import { DeleteConfirm } from '../components/DeleteConfirm/DeleteConfirm';
import {
  useBindingFolderBindings,
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
import { useDistributorCreate, useDistributorsList } from '../hooks/useDistributors';
import { fetchTag, fetchTagsList, searchTags } from '../api/tags';
import { fetchActor, fetchActorsList, searchActors } from '../api/actors';
import { fetchCreator, fetchCreatorsList, searchCreators } from '../api/creators';
import { fetchDistributor, fetchDistributorsList, searchDistributors } from '../api/distributors';
import { fetchVideoFileFolderChildren, fetchVideoFileFolderPrefixes } from '../api/videoFiles';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { EntityCreateAutocomplete } from '../components/EntityCreateAutocomplete/EntityCreateAutocomplete';
import { renderLucideIcon } from '../utils/lucideIcons';
import { getTagChipSx } from '../utils/tagChipSx';
import { validateListSearch } from '../schemas/listSearch';
import type {
  Actor,
  BindingFolderBindingItem,
  BindingStrategy,
  Creator,
  Distributor,
  FileDir,
  Tag,
  TagType,
} from '../api/types';

const STRATEGY_TYPES = [
  { value: 'folder' as const, label: '文件夹' },
  { value: 'regex' as const, label: '正则' },
];

export const Route = createFileRoute('/strategies')({
  validateSearch: validateListSearch,
  component: StrategiesPage,
});

const ENTITY_SELECTOR_PAGE_SIZE = 20;
const FOLDER_VIEW_PAGE_SIZE = 50;
const FOLDER_ROW_HEIGHT = 56;
const FOLDER_OVERSCAN = 8;

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

type FolderTreeRow =
  | { type: 'folder'; key: string; depth: number; node: FolderNode }
  | { type: 'load-more'; key: string; depth: number; node: FolderNode };

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
  if (s.distributorIds?.length) parts.push(`${s.distributorIds.length} 发行方`);
  return parts.length ? parts.join('、') : '-';
}

function buildFolderKey(fileDirId: number, folderPath: string): string {
  return `${fileDirId}:${folderPath}`;
}

function createEmptyCursorChunk<T>(): CursorChunk<T> {
  return {
    items: [],
    nextCursor: null,
    loading: false,
    loaded: false,
  };
}

function normalizeFolderPath(path: string): string {
  return path
    .trim()
    .replace(/[\\]+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function toFolderStrategyPath(path: string): string {
  const normalized = normalizeFolderPath(path);
  return normalized ? `${normalized}/` : '';
}

function buildMetaLabel(
  label: string,
  ids: number[],
  resolveName: (id: number) => string | null
): string | null {
  if (ids.length === 0) return null;
  const names = ids.map((id) => resolveName(id) ?? `#${id}`);
  const head = names.slice(0, 2).join('、');
  const remain = names.length > 2 ? ` +${names.length - 2}` : '';
  return `${label}:${head}${remain}`;
}

function StrategyFolderView(props: {
  fileDir: FileDir | null;
  bindingsMap: Map<string, BindingFolderBindingItem>;
  bindingsLoading: boolean;
  tagsMap: Map<number, Tag & { tagType?: TagType | null }>;
  creatorsMap: Map<number, Creator>;
  actorsMap: Map<number, Actor>;
  distributorsMap: Map<number, Distributor>;
  onEditFolderBinding: (node: FolderNode, binding: BindingFolderBindingItem | null) => void;
}) {
  const {
    fileDir,
    bindingsMap,
    bindingsLoading,
    tagsMap,
    creatorsMap,
    actorsMap,
    distributorsMap,
    onEditFolderBinding,
  } = props;

  const rootNode = useMemo<FolderNode | null>(
    () =>
      fileDir
        ? {
          fileDirId: fileDir.id,
          path: '',
          name: fileDir.path,
          isRoot: true,
        }
        : null,
    [fileDir]
  );

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderChildrenMap, setFolderChildrenMap] = useState<Record<string, CursorChunk<FolderNode>>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const folderChildrenMapRef = useRef<Record<string, CursorChunk<FolderNode>>>({});
  const loadingFolderKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    folderChildrenMapRef.current = folderChildrenMap;
  }, [folderChildrenMap]);

  const loadMoreChildren = useCallback(
    async (node: FolderNode) => {
      const key = buildFolderKey(node.fileDirId, node.path);
      const current = folderChildrenMapRef.current[key] ?? createEmptyCursorChunk<FolderNode>();
      if (loadingFolderKeysRef.current.has(key)) return;
      if (current.loading) return;
      if (current.loaded && !current.nextCursor) return;
      const cursor = current.nextCursor ?? undefined;

      loadingFolderKeysRef.current.add(key);
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
          const previous = prev[key] ?? createEmptyCursorChunk<FolderNode>();
          const merged = [...previous.items, ...res.items.map((it) => ({ ...it, isRoot: false }))];
          const dedupMap = new Map(merged.map((it) => [it.path, it]));
          const nextCursor = res.nextCursor && res.nextCursor !== (cursor ?? null) ? res.nextCursor : null;
          return {
            ...prev,
            [key]: {
              items: Array.from(dedupMap.values()),
              nextCursor,
              loading: false,
              loaded: true,
            },
          };
        });
      } catch {
        setFolderChildrenMap((prev) => {
          const previous = prev[key] ?? createEmptyCursorChunk<FolderNode>();
          return {
            ...prev,
            [key]: {
              ...previous,
              nextCursor: null,
              loading: false,
              loaded: true,
            },
          };
        });
      } finally {
        loadingFolderKeysRef.current.delete(key);
      }
    },
    []
  );

  useEffect(() => {
    queueMicrotask(() => {
      if (!rootNode) {
        loadingFolderKeysRef.current.clear();
        folderChildrenMapRef.current = {};
        setExpandedFolders(new Set());
        setFolderChildrenMap({});
        return;
      }
      const rootKey = buildFolderKey(rootNode.fileDirId, rootNode.path);
      loadingFolderKeysRef.current.clear();
      folderChildrenMapRef.current = {};
      setExpandedFolders(new Set([rootKey]));
      setFolderChildrenMap({});
      setScrollTop(0);
      void loadMoreChildren(rootNode);
    });
  }, [loadMoreChildren, rootNode]);

  const toggleExpandFolder = useCallback(
    (node: FolderNode) => {
      const key = buildFolderKey(node.fileDirId, node.path);
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      void loadMoreChildren(node);
    },
    [loadMoreChildren]
  );

  const rows = useMemo(() => {
    if (!rootNode) return [];
    const result: FolderTreeRow[] = [];
    const append = (node: FolderNode, depth: number) => {
      const key = buildFolderKey(node.fileDirId, node.path);
      result.push({ type: 'folder', key: `folder:${key}`, depth, node });
      if (!expandedFolders.has(key)) return;
      const childChunk = folderChildrenMap[key] ?? createEmptyCursorChunk<FolderNode>();
      for (const child of childChunk.items) {
        append(child, depth + 1);
      }
      if (childChunk.loading || childChunk.nextCursor) {
        result.push({
          type: 'load-more',
          key: `load-more:${key}`,
          depth: depth + 1,
          node,
        });
      }
    };

    append(rootNode, 0);
    return result;
  }, [expandedFolders, folderChildrenMap, rootNode]);

  const totalHeight = rows.length * FOLDER_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / FOLDER_ROW_HEIGHT) - FOLDER_OVERSCAN);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / FOLDER_ROW_HEIGHT) + FOLDER_OVERSCAN
  );
  const visibleRows = rows.slice(startIndex, endIndex);

  useEffect(() => {
    const loadingMap = new Map<string, FolderNode>();
    for (const row of visibleRows) {
      if (row.type !== 'load-more') continue;
      loadingMap.set(buildFolderKey(row.node.fileDirId, row.node.path), row.node);
    }
    if (loadingMap.size === 0) return;
    queueMicrotask(() => {
      for (const node of loadingMap.values()) {
        void loadMoreChildren(node);
      }
    });
  }, [visibleRows, loadMoreChildren]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight || 520);
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!fileDir) {
    return <Alert severity="info">请先选择启用的文件根路径。</Alert>;
  }

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Box
        ref={scrollRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        sx={{ height: 'calc(100vh - 330px)', overflow: 'auto', position: 'relative' }}
      >
        <Box sx={{ height: totalHeight || FOLDER_ROW_HEIGHT, position: 'relative' }}>
          {visibleRows.map((row, index) => {
            const absoluteIndex = startIndex + index;
            const top = absoluteIndex * FOLDER_ROW_HEIGHT;

            if (row.type === 'load-more') {
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
            }

            const key = buildFolderKey(row.node.fileDirId, row.node.path);
            const expanded = expandedFolders.has(key);
            const binding = row.node.isRoot ? null : bindingsMap.get(normalizeFolderPath(row.node.path)) ?? null;
            const tagLabel = binding
              ? buildMetaLabel('标签', binding.tagIds, (id) => {
                const tag = tagsMap.get(id);
                if (!tag) return null;
                return tag.tagType?.name ? `${tag.tagType.name}:${tag.name}` : tag.name;
              })
              : null;
            const creatorLabel = binding
              ? buildMetaLabel('创作者', binding.creatorIds, (id) => creatorsMap.get(id)?.name ?? null)
              : null;
            const actorLabel = binding
              ? buildMetaLabel('演员', binding.actorIds, (id) => actorsMap.get(id)?.name ?? null)
              : null;
            const distributorLabel = binding
              ? buildMetaLabel('发行方', binding.distributorIds, (id) => distributorsMap.get(id)?.name ?? null)
              : null;
            const metadataLabels = [tagLabel, creatorLabel, actorLabel, distributorLabel].filter(
              (label): label is string => !!label
            );

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
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => toggleExpandFolder(row.node)}
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <FolderTree size={16} />
                <Typography
                  variant="body2"
                  title={row.node.isRoot ? row.node.name : row.node.path}
                  sx={{
                    minWidth: 180,
                    maxWidth: 340,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.node.isRoot ? row.node.name : row.node.name}
                </Typography>
                {!row.node.isRoot && (
                  <Box
                    sx={{
                      ml: 'auto',
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      flex: 1,
                      justifyContent: 'flex-end',
                    }}
                  >
                    {bindingsLoading ? <CircularProgress size={14} /> : null}
                    {binding && metadataLabels.length > 0 ? (
                      metadataLabels.map((label) => (
                        <Chip
                          key={label}
                          label={label}
                          size="small"
                          variant="outlined"
                          sx={{ maxWidth: 200 }}
                        />
                      ))
                    ) : (
                      <Chip size="small" variant="outlined" label="未绑定" />
                    )}
                    {binding && !binding.enabled ? (
                      <Chip size="small" color="warning" label="未启用" />
                    ) : null}
                    {binding && binding.strategyCount > 1 ? (
                      <Chip size="small" color="warning" label={`多策略(${binding.strategyCount})`} />
                    ) : null}
                    <Button
                      size="small"
                      variant={binding ? 'outlined' : 'contained'}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditFolderBinding(row.node, binding);
                      }}
                    >
                      {binding ? '编辑' : '绑定'}
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
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
  const { data: distributorsData } = useDistributorsList(1, 100, '');

  const createMut = useBindingStrategyCreate();
  const updateMut = useBindingStrategyUpdate();
  const deleteMut = useBindingStrategyDelete();
  const applyMut = useApplyStrategy();
  const actorCreateMut = useActorCreate();
  const creatorCreateMut = useCreatorCreate();
  const distributorCreateMut = useDistributorCreate();

  const [searchDraft, setSearchDraft] = useState(keyword);
  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BindingStrategy | null>(null);
  const [formType, setFormType] = useState<'folder' | 'regex'>('folder');
  const [formFileDirId, setFormFileDirId] = useState<number | 'all'>('all');
  const [formFolderPath, setFormFolderPath] = useState('');
  const [formFilenameRegex, setFormFilenameRegex] = useState('');
  const [formTagIds, setFormTagIds] = useState<number[]>([]);
  const [formCreatorIds, setFormCreatorIds] = useState<number[]>([]);
  const [formActorIds, setFormActorIds] = useState<number[]>([]);
  const [formDistributorIds, setFormDistributorIds] = useState<number[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [additionalTags, setAdditionalTags] = useState<(Tag & { tagType?: TagType })[]>([]);
  const [additionalActors, setAdditionalActors] = useState<Actor[]>([]);
  const [additionalCreators, setAdditionalCreators] = useState<Creator[]>([]);
  const [additionalDistributors, setAdditionalDistributors] = useState<Distributor[]>([]);
  const [folderPrefixOptions, setFolderPrefixOptions] = useState<string[]>([]);
  const [folderPrefixLoading, setFolderPrefixLoading] = useState(false);
  const [folderPrefixTruncated, setFolderPrefixTruncated] = useState(false);
  const [selectedQuickPrefix, setSelectedQuickPrefix] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'folder'>('table');
  const [folderViewFileDirId, setFolderViewFileDirId] = useState<number | ''>('');

  const fileDirs = useMemo(() => (fileDirsData?.items ?? []) as FileDir[], [fileDirsData?.items]);
  const enabledFileDirs = useMemo(() => fileDirs.filter((dir) => dir.enabled), [fileDirs]);
  useEffect(() => {
    if (enabledFileDirs.length === 0) {
      if (folderViewFileDirId !== '') {
        setFolderViewFileDirId('');
      }
      return;
    }
    if (
      folderViewFileDirId === '' ||
      !enabledFileDirs.some((dir) => dir.id === folderViewFileDirId)
    ) {
      setFolderViewFileDirId(enabledFileDirs[0]?.id ?? '');
    }
  }, [enabledFileDirs, folderViewFileDirId]);

  const selectedFolderViewFileDir = useMemo(
    () =>
      folderViewFileDirId === ''
        ? null
        : enabledFileDirs.find((dir) => dir.id === folderViewFileDirId) ?? null,
    [enabledFileDirs, folderViewFileDirId]
  );
  const { data: folderBindingsData, isLoading: folderBindingsLoading } = useBindingFolderBindings(
    selectedFolderViewFileDir?.id ?? null
  );
  const folderBindingItems = useMemo(
    () => (folderBindingsData?.items ?? []) as BindingFolderBindingItem[],
    [folderBindingsData?.items]
  );
  const folderBindingsMap = useMemo(
    () => new Map(folderBindingItems.map((item) => [normalizeFolderPath(item.folderPath), item])),
    [folderBindingItems]
  );

  const folderBindingTags = useMemo(
    () =>
      (folderBindingsData?.tags ?? []) as (Tag & {
        tagType?: TagType | null;
      })[],
    [folderBindingsData?.tags]
  );
  const folderBindingCreators = useMemo(
    () => (folderBindingsData?.creators ?? []) as Creator[],
    [folderBindingsData?.creators]
  );
  const folderBindingActors = useMemo(
    () => (folderBindingsData?.actors ?? []) as Actor[],
    [folderBindingsData?.actors]
  );
  const folderBindingDistributors = useMemo(
    () => (folderBindingsData?.distributors ?? []) as Distributor[],
    [folderBindingsData?.distributors]
  );

  const tags = useMemo(
    () =>
      mergeById(
        mergeById(
          (tagsData?.items ?? []) as (Tag & { tagType?: TagType })[],
          folderBindingTags
        ),
        additionalTags
      ),
    [additionalTags, folderBindingTags, tagsData?.items]
  );
  const actors = useMemo(
    () => mergeById(mergeById((actorsData?.items ?? []) as Actor[], folderBindingActors), additionalActors),
    [actorsData?.items, additionalActors, folderBindingActors]
  );
  const creators = useMemo(
    () =>
      mergeById(
        mergeById((creatorsData?.items ?? []) as Creator[], folderBindingCreators),
        additionalCreators
      ),
    [additionalCreators, creatorsData?.items, folderBindingCreators]
  );
  const distributors = useMemo(
    () =>
      mergeById(
        mergeById((distributorsData?.items ?? []) as Distributor[], folderBindingDistributors),
        additionalDistributors
      ),
    [additionalDistributors, distributorsData?.items, folderBindingDistributors]
  );

  const tagsMap = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags]
  );
  const creatorsMap = useMemo(
    () => new Map(creators.map((creator) => [creator.id, creator])),
    [creators]
  );
  const actorsMap = useMemo(
    () => new Map(actors.map((actor) => [actor.id, actor])),
    [actors]
  );
  const distributorsMap = useMemo(
    () => new Map(distributors.map((distributor) => [distributor.id, distributor])),
    [distributors]
  );

  const handleOpenCreate = () => {
    setEditing(null);
    setFormType('folder');
    setFormFileDirId('all');
    setFormFolderPath('');
    setFormFilenameRegex('');
    setFormTagIds([]);
    setFormCreatorIds([]);
    setFormActorIds([]);
    setFormDistributorIds([]);
    setFormEnabled(true);
    setAdditionalTags([]);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    setAdditionalDistributors([]);
    setFolderPrefixOptions([]);
    setFolderPrefixLoading(false);
    setFolderPrefixTruncated(false);
    setSelectedQuickPrefix('');
    setFormOpen(true);
  };

  const handleOpenEdit = (row: BindingStrategy) => {
    setEditing(row);
    setFormType(row.type);
    setFormFileDirId(row.fileDirId ?? 'all');
    setFormFolderPath(row.folderPath ?? '');
    setFormFilenameRegex(row.filenameRegex ?? '');
    setFormTagIds(row.tagIds ?? []);
    setFormCreatorIds(row.creatorIds ?? []);
    setFormActorIds(row.actorIds ?? []);
    setFormDistributorIds(row.distributorIds ?? []);
    setFormEnabled(row.enabled);
    setAdditionalTags([]);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    setAdditionalDistributors([]);
    setFolderPrefixOptions([]);
    setFolderPrefixLoading(false);
    setFolderPrefixTruncated(false);
    setSelectedQuickPrefix('');
    setFormOpen(true);
  };

  const handleOpenFolderBindingEditor = (
    node: FolderNode,
    binding: BindingFolderBindingItem | null
  ) => {
    const folderPath = toFolderStrategyPath(node.path);
    if (!folderPath) return;
    const baseFileDirId = node.fileDirId;

    if (binding?.primaryStrategyId) {
      setEditing({
        id: binding.primaryStrategyId,
        type: 'folder',
        fileDirId: baseFileDirId,
        folderPath,
        filenameRegex: null,
        tagIds: [...binding.tagIds],
        creatorIds: [...binding.creatorIds],
        actorIds: [...binding.actorIds],
        distributorIds: [...binding.distributorIds],
        enabled: binding.enabled,
        createdAt: '',
        updatedAt: '',
      });
      setFormTagIds([...binding.tagIds]);
      setFormCreatorIds([...binding.creatorIds]);
      setFormActorIds([...binding.actorIds]);
      setFormDistributorIds([...binding.distributorIds]);
      setFormEnabled(binding.enabled);
    } else {
      setEditing(null);
      setFormTagIds([]);
      setFormCreatorIds([]);
      setFormActorIds([]);
      setFormDistributorIds([]);
      setFormEnabled(true);
    }

    setFormType('folder');
    setFormFileDirId(baseFileDirId);
    setFormFolderPath(folderPath);
    setFormFilenameRegex('');
    setAdditionalTags([]);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    setAdditionalDistributors([]);
    setFolderPrefixOptions([]);
    setFolderPrefixLoading(false);
    setFolderPrefixTruncated(false);
    setSelectedQuickPrefix('');
    setFormOpen(true);
    if (editId) navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
  };

  useEffect(() => {
    if (strategyDetail) {
      setFormType(strategyDetail.type);
      setFormFileDirId(strategyDetail.fileDirId ?? 'all');
      setFormFolderPath(strategyDetail.folderPath ?? '');
      setFormFilenameRegex(strategyDetail.filenameRegex ?? '');
      setFormTagIds(strategyDetail.tagIds ?? []);
      setFormCreatorIds(strategyDetail.creatorIds ?? []);
      setFormActorIds(strategyDetail.actorIds ?? []);
      setFormDistributorIds(strategyDetail.distributorIds ?? []);
      setFormEnabled(strategyDetail.enabled);
    }
  }, [strategyDetail]);

  useEffect(() => {
    if (editId && strategyDetail) {
      setEditing(strategyDetail);
      setFormOpen(true);
    }
  }, [editId, strategyDetail]);

  useEffect(() => {
    if (!formOpen || formType !== 'folder' || formFileDirId === 'all') {
      setFolderPrefixOptions([]);
      setFolderPrefixLoading(false);
      setFolderPrefixTruncated(false);
      setSelectedQuickPrefix('');
      return;
    }

    let cancelled = false;
    const loadPrefixes = async () => {
      setFolderPrefixLoading(true);
      try {
        const result = await fetchVideoFileFolderPrefixes({
          fileDirId: Number(formFileDirId),
          limit: 5000,
        });

        if (!cancelled) {
          setFolderPrefixOptions(result.items);
          setFolderPrefixTruncated(result.truncated);
        }
      } catch {
        if (!cancelled) {
          setFolderPrefixOptions([]);
          setFolderPrefixTruncated(false);
        }
      } finally {
        if (!cancelled) {
          setFolderPrefixLoading(false);
        }
      }
    };

    void loadPrefixes();
    return () => {
      cancelled = true;
    };
  }, [formFileDirId, formOpen, formType]);

  useEffect(() => {
    if (!formOpen) return;

    const missingTagIds = formTagIds.filter((id) => !tags.some((item) => item.id === id));
    const missingCreatorIds = formCreatorIds.filter((id) =>
      !creators.some((item) => item.id === id)
    );
    const missingActorIds = formActorIds.filter((id) => !actors.some((item) => item.id === id));
    const missingDistributorIds = formDistributorIds.filter(
      (id) => !distributors.some((item) => item.id === id)
    );
    if (
      missingTagIds.length === 0 &&
      missingCreatorIds.length === 0 &&
      missingActorIds.length === 0 &&
      missingDistributorIds.length === 0
    ) {
      return;
    }

    let cancelled = false;
    const loadMissing = async () => {
      const [tagRows, creatorRows, actorRows, distributorRows] = await Promise.all([
        Promise.all(
          missingTagIds.map(async (id) => {
            try {
              return await fetchTag(id);
            } catch {
              return null;
            }
          })
        ),
        Promise.all(
          missingCreatorIds.map(async (id) => {
            try {
              return await fetchCreator(id);
            } catch {
              return null;
            }
          })
        ),
        Promise.all(
          missingActorIds.map(async (id) => {
            try {
              return await fetchActor(id);
            } catch {
              return null;
            }
          })
        ),
        Promise.all(
          missingDistributorIds.map(async (id) => {
            try {
              return await fetchDistributor(id);
            } catch {
              return null;
            }
          })
        ),
      ]);

      if (cancelled) return;
      setAdditionalTags((prev) =>
        mergeById(prev, tagRows.filter((item): item is Tag & { tagType?: TagType } => !!item))
      );
      setAdditionalCreators((prev) =>
        mergeById(prev, creatorRows.filter((item): item is Creator => !!item))
      );
      setAdditionalActors((prev) =>
        mergeById(prev, actorRows.filter((item): item is Actor => !!item))
      );
      setAdditionalDistributors((prev) =>
        mergeById(prev, distributorRows.filter((item): item is Distributor => !!item))
      );
    };

    void loadMissing();
    return () => {
      cancelled = true;
    };
  }, [
    actors,
    creators,
    distributors,
    formActorIds,
    formCreatorIds,
    formDistributorIds,
    formOpen,
    formTagIds,
    tags,
  ]);

  const handleFormClose = () => {
    setFormOpen(false);
    setEditing(null);
    setAdditionalTags([]);
    setAdditionalActors([]);
    setAdditionalCreators([]);
    setAdditionalDistributors([]);
    setFolderPrefixOptions([]);
    setFolderPrefixLoading(false);
    setFolderPrefixTruncated(false);
    setSelectedQuickPrefix('');
    if (editId) navigate({ search: (prev) => ({ ...prev, editId: undefined }) });
  };

  const handleFormSubmit = async () => {
    const payload = {
      type: formType,
      fileDirId: formFileDirId === 'all' ? null : Number(formFileDirId),
      folderPath: formType === 'folder' ? formFolderPath.trim() || null : null,
      filenameRegex: formType === 'regex' ? formFilenameRegex.trim() || null : null,
      tagIds: formTagIds,
      creatorIds: formCreatorIds,
      actorIds: formActorIds,
      distributorIds: formDistributorIds,
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
      render: (r) => (r.fileDir as { path?: string })?.path ?? (r.fileDirId == null ? '全部目录' : `#${r.fileDirId}`),
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
  const selectedDistributors = distributors.filter((d) => formDistributorIds.includes(d.id));

  const formValid =
    formType === 'folder'
      ? formFolderPath.trim().length > 0
      : formFilenameRegex.trim().length > 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          绑定策略
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, mode: 'table' | 'folder' | null) => {
              if (!mode) return;
              setViewMode(mode);
            }}
            aria-label="策略视图切换"
          >
            <ToggleButton value="table" aria-label="列表视图">
              <List size={16} />
            </ToggleButton>
            <ToggleButton value="folder" aria-label="文件夹视图">
              <FolderTree size={16} />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={handleOpenCreate}>
            新建
          </Button>
        </Box>
      </Box>

      {viewMode === 'folder' ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TextField
              select
              size="small"
              label="文件根路径"
              value={folderViewFileDirId}
              onChange={(e) =>
                setFolderViewFileDirId(e.target.value === '' ? '' : Number(e.target.value))
              }
              sx={{ minWidth: 360 }}
            >
              <MenuItem value="" disabled>
                {enabledFileDirs.length === 0 ? '暂无可用目录' : '请选择目录'}
              </MenuItem>
              {enabledFileDirs.map((dir) => (
                <MenuItem key={dir.id} value={dir.id}>
                  {dir.path}
                </MenuItem>
              ))}
            </TextField>
            {selectedFolderViewFileDir ? (
              <Typography variant="body2" color="text.secondary">
                当前根路径共 {folderBindingItems.length} 个已配置绑定文件夹
              </Typography>
            ) : null}
          </Box>
          <StrategyFolderView
            fileDir={selectedFolderViewFileDir}
            bindingsMap={folderBindingsMap}
            bindingsLoading={folderBindingsLoading}
            tagsMap={tagsMap}
            creatorsMap={creatorsMap}
            actorsMap={actorsMap}
            distributorsMap={distributorsMap}
            onEditFolderBinding={handleOpenFolderBindingEditor}
          />
        </>
      ) : (
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
              <Button
                size="small"
                startIcon={<Pencil size={14} />}
                onClick={() => handleOpenEdit(row)}
              >
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
      )}

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
              setFormFileDirId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            fullWidth
          >
            <MenuItem value="all">全部目录</MenuItem>
            {fileDirs.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.path}
              </MenuItem>
            ))}
          </TextField>
          {formType === 'folder' && (
            <>
              <TextField
                label="文件夹路径前缀"
                value={formFolderPath}
                onChange={(e) => setFormFolderPath(e.target.value)}
                placeholder="例如 actor-a/"
                fullWidth
                required
              />
              <TextField
                select
                label="快速选择前缀"
                value={selectedQuickPrefix}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedQuickPrefix(value);
                  if (value) {
                    setFormFolderPath(value);
                  }
                }}
                helperText={
                  folderPrefixLoading
                    ? '正在加载可用前缀...'
                    : folderPrefixTruncated
                      ? '前缀过多，仅展示前 5000 条，请手动输入更深路径'
                    : folderPrefixOptions.length > 0
                      ? '选择后会自动填入上方前缀输入框'
                      : '当前目录暂无可选前缀，可手动输入'
                }
                fullWidth
              >
                <MenuItem value="">手动输入</MenuItem>
                {folderPrefixOptions.map((prefix) => {
                  const value = prefix.endsWith('/') ? prefix : `${prefix}/`;
                  return (
                    <MenuItem key={prefix} value={value}>
                      {value}
                    </MenuItem>
                  );
                })}
              </TextField>
            </>
          )}
          {formType === 'regex' && (
            <TextField
              label="文件名正则"
              value={formFilenameRegex}
              onChange={(e) => setFormFilenameRegex(e.target.value)}
              placeholder="例如 /nightalks\\.com/i 或 .*\\.mp4$"
              helperText="支持 JS 正则字面量写法（/pattern/flags）"
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
            onSelectionObjectsChange={(items) =>
              setAdditionalTags((prev) => mergeById(prev, items))
            }
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
                    sx={getTagChipSx(t.color)}
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
            onSelectionObjectsChange={(items) =>
              setAdditionalCreators((prev) => mergeById(prev, items))
            }
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
          <EntityCreateAutocomplete<Distributor>
            label="发行方"
            placeholder="搜索发行方，不存在可直接新建"
            options={distributors}
            value={selectedDistributors}
            onChange={setFormDistributorIds}
            onSelectionObjectsChange={(items) =>
              setAdditionalDistributors((prev) => mergeById(prev, items))
            }
            pageSize={ENTITY_SELECTOR_PAGE_SIZE}
            loadOptions={({ keyword, page, pageSize }) =>
              keyword.trim()
                ? searchDistributors(keyword.trim(), page, pageSize)
                : fetchDistributorsList(page, pageSize)
            }
            getOptionLabel={(d) => d.name}
            renderOption={(_, d) => <EntityPreview entityType="distributor" entity={d} inline />}
            onCreate={async (name) => distributorCreateMut.mutateAsync({ name })}
            onCreated={(entity) =>
              setAdditionalDistributors((prev) => mergeById(prev, [entity]))
            }
          />
          <EntityCreateAutocomplete<Actor>
            label="演员"
            placeholder="搜索演员，不存在可直接新建"
            options={actors}
            value={selectedActors}
            onChange={setFormActorIds}
            onSelectionObjectsChange={(items) =>
              setAdditionalActors((prev) => mergeById(prev, items))
            }
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

