/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, useMediaQuery } from '@mui/material';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'al_media_theme_mode';

interface ThemeModeContextValue {
  preference: ThemePreference;
  resolvedMode: 'light' | 'dark';
  setPreference: (next: ThemePreference) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // ignore localStorage failures
  }
  return 'system';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference());
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const resolvedMode: 'light' | 'dark' = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignore localStorage failures
    }
  }, [preference]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode: resolvedMode },
      }),
    [resolvedMode]
  );

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      preference,
      resolvedMode,
      setPreference,
    }),
    [preference, resolvedMode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return context;
}
