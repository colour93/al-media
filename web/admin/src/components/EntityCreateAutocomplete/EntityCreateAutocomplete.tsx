import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, TextField, Box } from '@mui/material';
import { Plus } from 'lucide-react';
import type { PaginatedResult } from '../../api/types';

const CREATE_OPTION = Symbol('__createNew');

export interface CreateOption {
  [CREATE_OPTION]: true;
  name: string;
}

function isCreateOption<T>(opt: T | CreateOption): opt is CreateOption {
  return typeof opt === 'object' && opt !== null && CREATE_OPTION in opt;
}

export interface EntityCreateAutocompleteProps<T extends { id: number; name: string }> {
  label: string;
  placeholder?: string;
  options?: T[];
  value: T[];
  onChange: (ids: number[]) => void;
  onSelectionObjectsChange?: (items: T[]) => void;
  getOptionLabel: (opt: T) => string;
  renderOption?: (props: React.HTMLAttributes<HTMLLIElement>, opt: T) => React.ReactNode;
  renderTags?: (value: T[], getTagProps: (params: { index: number }) => Record<string, unknown>) => React.ReactNode;
  onCreate?: (name: string) => Promise<T>;
  /** 创建成功后调用，用于将新实体加入选项列表（因列表可能未及时刷新） */
  onCreated?: (entity: T) => void;
  createLabel?: string;
  pageSize?: number;
  loadOptions?: (params: {
    keyword: string;
    page: number;
    pageSize: number;
  }) => Promise<PaginatedResult<T>>;
}

export function EntityCreateAutocomplete<T extends { id: number; name: string }>({
  label,
  placeholder = '选择或输入新建',
  options = [],
  value,
  onChange,
  onSelectionObjectsChange,
  getOptionLabel,
  renderOption,
  renderTags,
  onCreate,
  onCreated,
  createLabel = '新建',
  pageSize = 20,
  loadOptions,
}: EntityCreateAutocompleteProps<T>) {
  const [inputValue, setInputValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteItems, setRemoteItems] = useState<T[]>([]);
  const [remotePage, setRemotePage] = useState(0);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const requestIdRef = useRef(0);

  const mergeUnique = useCallback((items: T[]) => {
    const map = new Map<number, T>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return Array.from(map.values());
  }, []);

  const loadPage = useCallback(
    async (page: number, keyword: string, append: boolean) => {
      if (!loadOptions) return;
      const requestId = ++requestIdRef.current;
      setRemoteLoading(true);
      try {
        const result = await loadOptions({
          keyword,
          page,
          pageSize,
        });
        if (requestId !== requestIdRef.current) return;
        setRemotePage(result.page);
        setRemoteTotal(result.total);
        setRemoteItems((prev) =>
          append ? mergeUnique([...prev, ...result.items]) : mergeUnique(result.items)
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setRemoteLoading(false);
        }
      }
    },
    [loadOptions, mergeUnique, pageSize]
  );

  useEffect(() => {
    if (!open || !loadOptions) return;
    const keyword = inputValue.trim();
    const timer = setTimeout(() => {
      void loadPage(1, keyword, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [inputValue, loadOptions, loadPage, open]);

  const hasMore = remoteItems.length < remoteTotal;

  const baseOptions = useMemo(() => {
    const remoteOrLocal = loadOptions ? remoteItems : options;
    return mergeUnique([...remoteOrLocal, ...value]);
  }, [loadOptions, mergeUnique, options, remoteItems, value]);

  const createOpt: CreateOption = { [CREATE_OPTION]: true, name: inputValue.trim() };
  const showCreate =
    !!onCreate &&
    inputValue.trim().length > 0 &&
    !baseOptions.some((o) => getOptionLabel(o).toLowerCase() === inputValue.trim().toLowerCase());

  const allOptions: (T | CreateOption)[] = showCreate ? [...baseOptions, createOpt] : baseOptions;

  const handleChange = async (
    _: React.SyntheticEvent,
    newValue: (T | CreateOption)[],
    reason: string
  ) => {
    if (reason === 'clear') {
      onChange([]);
      onSelectionObjectsChange?.([]);
      return;
    }
    const createSelected = newValue.find(isCreateOption);
    if (createSelected) {
      if (!onCreate) return;
      setCreating(true);
      try {
        const created = await onCreate(createSelected.name);
        onCreated?.(created);
        const nextSelected = mergeUnique([...value, created]);
        onChange(nextSelected.map((item) => item.id));
        onSelectionObjectsChange?.(nextSelected);
        setInputValue('');
        setRemoteItems((prev) => mergeUnique([...prev, created]));
      } finally {
        setCreating(false);
      }
      return;
    }
    const selected = newValue.filter((o): o is T => !isCreateOption(o));
    onChange(selected.map((o) => o.id));
    onSelectionObjectsChange?.(selected);
  };

  return (
    <Autocomplete<T | CreateOption, true>
      multiple
      options={allOptions}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onChange={handleChange}
      getOptionLabel={(opt) => (isCreateOption(opt) ? `${createLabel}「${opt.name}」` : getOptionLabel(opt))}
      isOptionEqualToValue={(opt, val) => {
        if (isCreateOption(opt)) return false;
        return (val as T).id === opt.id;
      }}
      filterOptions={(x) => x}
      loading={creating || remoteLoading}
      ListboxProps={
        loadOptions
          ? {
              onScroll: (event: React.UIEvent<HTMLUListElement>) => {
                if (remoteLoading || !hasMore) return;
                const listboxNode = event.currentTarget;
                if (
                  listboxNode.scrollTop + listboxNode.clientHeight >=
                  listboxNode.scrollHeight - 24
                ) {
                  void loadPage(remotePage + 1, inputValue.trim(), true);
                }
              },
            }
          : undefined
      }
      renderOption={(props, opt) => {
        if (isCreateOption(opt)) {
          return (
            <li {...props} key={`create-${opt.name}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Plus size={16} />
                <span>{createLabel}「{opt.name}」</span>
              </Box>
            </li>
          );
        }
        return renderOption ? (
          <li {...props} key={(opt as T).id}>
            {renderOption(props, opt as T)}
          </li>
        ) : (
          <li {...props} key={(opt as T).id}>
            {getOptionLabel(opt as T)}
          </li>
        );
      }}
      renderTags={
        renderTags
          ? (value, getTagProps) =>
              renderTags(
                value.filter((item): item is T => !isCreateOption(item)),
                (params) => getTagProps(params)
              )
          : undefined
      }
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} />
      )}
    />
  );
}
