import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, TextField } from '@mui/material';
import { Plus } from 'lucide-react';
import type { PaginatedResult } from '../../api/types';

const CREATE_OPTION = Symbol('__createNewSingle');

type CreateOption = {
  [CREATE_OPTION]: true;
  name: string;
};

function isCreateOption<T>(opt: T | CreateOption): opt is CreateOption {
  return typeof opt === 'object' && opt !== null && CREATE_OPTION in opt;
}

export interface EntityCreateSingleAutocompleteProps<T extends { id: number; name: string }> {
  label: string;
  placeholder?: string;
  value: T | null;
  options?: T[];
  onChange: (value: T | null) => void;
  getOptionLabel: (opt: T) => string;
  renderOption?: (props: React.HTMLAttributes<HTMLLIElement>, opt: T) => React.ReactNode;
  onCreate?: (name: string) => Promise<T>;
  onCreated?: (entity: T) => void;
  createLabel?: string;
  pageSize?: number;
  loadOptions?: (params: {
    keyword: string;
    page: number;
    pageSize: number;
  }) => Promise<PaginatedResult<T>>;
}

export function EntityCreateSingleAutocomplete<T extends { id: number; name: string }>({
  label,
  placeholder = '搜索并选择',
  value,
  options = [],
  onChange,
  getOptionLabel,
  renderOption,
  onCreate,
  onCreated,
  createLabel = '新建',
  pageSize = 20,
  loadOptions,
}: EntityCreateSingleAutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [creating, setCreating] = useState(false);
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
        const result = await loadOptions({ keyword, page, pageSize });
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
    return mergeUnique([...remoteOrLocal, ...(value ? [value] : [])]);
  }, [loadOptions, mergeUnique, options, remoteItems, value]);

  const createOption: CreateOption = { [CREATE_OPTION]: true, name: inputValue.trim() };
  const showCreate =
    !!onCreate &&
    inputValue.trim().length > 0 &&
    !baseOptions.some((o) => getOptionLabel(o).toLowerCase() === inputValue.trim().toLowerCase());
  const allOptions: (T | CreateOption)[] = showCreate ? [...baseOptions, createOption] : baseOptions;

  return (
    <Autocomplete<T | CreateOption, false, false, false>
      options={allOptions}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onChange={async (_, newValue) => {
        if (!newValue) {
          onChange(null);
          return;
        }
        if (isCreateOption(newValue)) {
          if (!onCreate) return;
          setCreating(true);
          try {
            const created = await onCreate(newValue.name);
            onCreated?.(created);
            onChange(created);
            setInputValue('');
            setRemoteItems((prev) => mergeUnique([...prev, created]));
          } finally {
            setCreating(false);
          }
          return;
        }
        onChange(newValue);
      }}
      getOptionLabel={(opt) => (isCreateOption(opt) ? `${createLabel}「${opt.name}」` : getOptionLabel(opt))}
      isOptionEqualToValue={(opt, val) => {
        if (isCreateOption(opt) || isCreateOption(val)) return false;
        return opt.id === val.id;
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
          <li {...props} key={opt.id}>
            {renderOption(props, opt)}
          </li>
        ) : (
          <li {...props} key={opt.id}>
            {getOptionLabel(opt)}
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );
}
