import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import { PwaInstallProvider } from './contexts/PwaInstallContext';
import { fetchAuthConfig } from './api/auth';
import { applySiteConfigToHead, DEFAULT_SITE_CONFIG } from './config/site';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

if (typeof document !== 'undefined') {
  applySiteConfigToHead(DEFAULT_SITE_CONFIG);
  void fetchAuthConfig()
    .then((config) => {
      applySiteConfigToHead(config.site);
    })
    .catch(() => {
      applySiteConfigToHead(DEFAULT_SITE_CONFIG);
    });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeModeProvider>
          <PwaInstallProvider>
            <RouterProvider router={router} />
          </PwaInstallProvider>
        </ThemeModeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
