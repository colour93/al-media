import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { SnackbarProvider } from './contexts/SnackbarContext';
import { EntityRelatedProvider } from './contexts/EntityRelatedContext';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import { router } from './router';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeModeProvider>
          <SnackbarProvider>
            <EntityRelatedProvider>
              <RouterProvider router={router} />
            </EntityRelatedProvider>
          </SnackbarProvider>
        </ThemeModeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
