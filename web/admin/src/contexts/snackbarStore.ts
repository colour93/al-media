import { createContext } from 'react';

export interface SnackbarContextValue {
  showMessage: (msg: string, severity?: 'success' | 'info' | 'warning' | 'error') => void;
  showError: (msg: string) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue | null>(null);
