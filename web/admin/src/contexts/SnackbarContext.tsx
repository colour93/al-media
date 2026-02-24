import React, { createContext, useCallback, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

interface SnackbarContextValue {
  showMessage: (msg: string, severity?: 'success' | 'info' | 'warning' | 'error') => void;
  showError: (msg: string) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');

  const showMessage = useCallback(
    (msg: string, sev: 'success' | 'info' | 'warning' | 'error' = 'info') => {
      setMessage(msg);
      setSeverity(sev);
      setOpen(true);
    },
    []
  );

  const showError = useCallback((msg: string) => showMessage(msg, 'error'), [showMessage]);

  return (
    <SnackbarContext.Provider value={{ showMessage, showError }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setOpen(false)} severity={severity} variant="filled">
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
