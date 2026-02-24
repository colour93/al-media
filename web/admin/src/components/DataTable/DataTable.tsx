import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TextField,
  InputAdornment,
  Typography,
  CircularProgress,
  TableSortLabel,
} from '@mui/material';
import { Search } from 'lucide-react';

const parseWidth = (w: string | number | undefined): number => {
  if (typeof w === 'number') return w;
  if (typeof w === 'string') {
    const n = parseInt(w, 10);
    return Number.isNaN(n) ? 120 : n;
  }
  return 120;
};

export interface DataTableColumn<T> {
  id: string;
  label: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
}

const STORAGE_PREFIX = 'DataTable_colWidths_';

export interface DataTableProps<T> {
  /** 表格唯一标识，用于持久化列宽到 localStorage */
  tableId?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearch?: (keyword: string) => void;
  searchDebounceMs?: number;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

export function DataTable<T extends { id?: number }>({
  tableId,
  columns,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  searchPlaceholder = '搜索…',
  searchValue,
  onSearchChange,
  onSearch,
  searchDebounceMs = 300,
  actions,
  emptyMessage = '暂无数据',
  sortBy,
  sortOrder,
  onSortChange,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState('');
  const searchInput = searchValue !== undefined ? searchValue : internalSearch;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultWidths = useMemo(
    () => Object.fromEntries(columns.map((col) => [col.id, parseWidth(col.width)])),
    [columns]
  );
  const storageKey = tableId ? `${STORAGE_PREFIX}${tableId}` : null;
  const savedWidthsRef = useRef<Record<string, number> | null | undefined>(undefined);
  if (storageKey && savedWidthsRef.current === undefined) {
    try {
      const raw = localStorage.getItem(storageKey);
      savedWidthsRef.current = raw ? (JSON.parse(raw) as Record<string, number>) : null;
    } catch {
      savedWidthsRef.current = null;
    }
  }
  const initialWidths = useMemo(() => {
    const base = { ...defaultWidths };
    const saved = storageKey ? savedWidthsRef.current : null;
    if (saved && typeof saved === 'object') {
      for (const col of columns) {
        const w = saved[col.id];
        if (typeof w === 'number' && w >= 40) base[col.id] = w;
      }
    }
    return base;
  }, [columns, defaultWidths, storageKey]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialWidths);
  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...defaultWidths, ...prev };
      let changed = false;
      for (const col of columns) {
        const def = parseWidth(col.width);
        if (next[col.id] === undefined) {
          next[col.id] = def;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns, defaultWidths]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    } catch {}
  }, [storageKey, columnWidths]);

  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);
  const [resizeActive, setResizeActive] = useState(false);

  const handleResizeStart = useCallback(
    (colId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        colId,
        startX: e.clientX,
        startW: columnWidths[colId] ?? 120,
      };
      setResizeActive(true);
    },
    [columnWidths]
  );

  useEffect(() => {
    if (!resizeActive) return;
    const handleMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const delta = e.clientX - r.startX;
      const newW = Math.max(40, r.startW + delta);
      setColumnWidths((prev) => ({ ...prev, [r.colId]: newW }));
    };
    const handleUp = () => {
      resizeRef.current = null;
      setResizeActive(false);
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizeActive]);

  useEffect(() => {
    if (!onSearch) return;
    const id = setTimeout(() => onSearch(searchInput.trim()), searchDebounceMs);
    debounceRef.current = id;
    return () => {
      clearTimeout(id);
      debounceRef.current = null;
    };
  }, [searchInput, onSearch, searchDebounceMs]);

  const handleSearchChange = useCallback(
    (value: string) => {
      if (onSearchChange) onSearchChange(value);
      else if (searchValue === undefined) setInternalSearch(value);
    },
    [onSearchChange, searchValue]
  );

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {onSearch && (
        <Box sx={{ p: 2, pb: 0 }}>
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
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
      )}
      <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => {
                const sortKey = col.sortKey ?? col.id;
                const isSortable = col.sortable && onSortChange;
                const isActive = sortBy === sortKey;
                const w = columnWidths[col.id] ?? parseWidth(col.width);
                return (
                  <TableCell
                    key={col.id}
                    align={col.align ?? 'left'}
                    sx={{
                      fontWeight: 600,
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      position: 'relative',
                      pr: 0.5,
                    }}
                    sortDirection={isSortable && isActive ? sortOrder : false}
                  >
                    {isSortable ? (
                      <TableSortLabel
                        active={isActive}
                        direction={isActive ? sortOrder : 'asc'}
                        onClick={() => {
                          const next = isActive && sortOrder === 'desc' ? 'asc' : 'desc';
                          onSortChange?.(sortKey, next);
                        }}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                    <Box
                      component="span"
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(e) => handleResizeStart(col.id, e)}
                      sx={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 12,
                        cursor: 'col-resize',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        '&:hover': { bgcolor: 'action.hover' },
                        '&::after': {
                          content: '""',
                          width: 2,
                          height: 20,
                          borderRadius: 1,
                          bgcolor: 'divider',
                        },
                      }}
                    />
                  </TableCell>
                );
              })}
              {actions && <TableCell align="right" sx={{ width: 120, minWidth: 120 }}>操作</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={(row as { id?: number }).id ?? JSON.stringify(row)} hover>
                  {columns.map((col) => {
                    const w = columnWidths[col.id] ?? parseWidth(col.width);
                    return (
                      <TableCell
                        key={col.id}
                        align={col.align ?? 'left'}
                        sx={{ width: w, minWidth: w, maxWidth: w, overflow: 'hidden' }}
                      >
                        {col.render(row)}
                      </TableCell>
                    );
                  })}
                  {actions && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        onPageChange={(_, p) => onPageChange(p + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="每页"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
      />
    </Paper>
  );
}
