import { useState } from 'react';
import { Autocomplete, TextField, Box } from '@mui/material';
import { Plus } from 'lucide-react';

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
  options: T[];
  value: T[];
  onChange: (ids: number[]) => void;
  getOptionLabel: (opt: T) => string;
  renderOption?: (props: React.HTMLAttributes<HTMLLIElement>, opt: T) => React.ReactNode;
  renderTags?: (value: T[], getTagProps: (params: { index: number }) => Record<string, unknown>) => React.ReactNode;
  onCreate: (name: string) => Promise<T>;
  /** 创建成功后调用，用于将新实体加入选项列表（因列表可能未及时刷新） */
  onCreated?: (entity: T) => void;
  createLabel?: string;
}

export function EntityCreateAutocomplete<T extends { id: number; name: string }>({
  label,
  placeholder = '选择或输入新建',
  options,
  value,
  onChange,
  getOptionLabel,
  renderOption,
  renderTags,
  onCreate,
  onCreated,
  createLabel = '新建',
}: EntityCreateAutocompleteProps<T>) {
  const [inputValue, setInputValue] = useState('');
  const [creating, setCreating] = useState(false);

  const createOpt: CreateOption = { [CREATE_OPTION]: true, name: inputValue.trim() };
  const showCreate =
    inputValue.trim().length > 0 &&
    !options.some((o) => getOptionLabel(o).toLowerCase() === inputValue.trim().toLowerCase());

  const allOptions: (T | CreateOption)[] = showCreate ? [...options, createOpt] : options;

  const handleChange = async (
    _: React.SyntheticEvent,
    newValue: (T | CreateOption)[],
    reason: string
  ) => {
    const createSelected = newValue.find(isCreateOption);
    if (createSelected) {
      setCreating(true);
      try {
        const created = await onCreate(createSelected.name);
        onCreated?.(created);
        onChange([...value.map((v) => v.id), created.id]);
        setInputValue('');
      } finally {
        setCreating(false);
      }
      return;
    }
    onChange(newValue.filter((o): o is T => !isCreateOption(o)).map((o) => o.id));
  };

  return (
    <Autocomplete<T | CreateOption, true>
      multiple
      options={allOptions}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, v) => setInputValue(v)}
      onChange={handleChange}
      getOptionLabel={(opt) => (isCreateOption(opt) ? `${createLabel}「${opt.name}」` : getOptionLabel(opt))}
      isOptionEqualToValue={(opt, val) => {
        if (isCreateOption(opt)) return false;
        return (val as T).id === opt.id;
      }}
      filterOptions={(x) => x}
      loading={creating}
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
      renderTags={renderTags}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} />
      )}
    />
  );
}
