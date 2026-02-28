import { useMemo, useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { Laptop, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '../../contexts/ThemeModeContext';
import { useThemeMode } from '../../contexts/ThemeModeContext';

const options: Array<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: 'system', label: '跟随系统', Icon: Laptop },
  { value: 'light', label: '浅色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
];

export function ThemeModeButton() {
  const { preference, setPreference } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const current = useMemo(
    () => options.find((option) => option.value === preference) ?? options[0],
    [preference]
  );

  const open = Boolean(anchorEl);
  const CurrentIcon = current.Icon;

  return (
    <>
      <Tooltip title={`主题：${current.label}`}>
        <IconButton color="inherit" onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="切换主题">
          <CurrentIcon size={20} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {options.map((option) => {
          const OptionIcon = option.Icon;
          return (
            <MenuItem
              key={option.value}
              selected={option.value === preference}
              onClick={() => {
                setPreference(option.value);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <OptionIcon size={16} />
              </ListItemIcon>
              <ListItemText>{option.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
