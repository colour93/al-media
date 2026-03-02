/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const PWA_AUTO_PROMPT_DISMISSED_KEY = 'al_media_pwa_auto_prompt_dismissed';

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

type InstallPromptChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

interface DeferredInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallPromptChoice>;
}

interface PwaInstallContextValue {
  isStandalone: boolean;
  canPromptInstall: boolean;
  canInstall: boolean;
  shouldAutoPrompt: boolean;
  requestInstall: () => Promise<InstallOutcome>;
  dismissAutoPrompt: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function detectStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function readAutoPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PWA_AUTO_PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistAutoPromptDismissed(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(PWA_AUTO_PROMPT_DISMISSED_KEY, '1');
    } else {
      window.localStorage.removeItem(PWA_AUTO_PROMPT_DISMISSED_KEY);
    }
  } catch {
    // ignore localStorage failures
  }
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [autoPromptDismissed, setAutoPromptDismissed] = useState<boolean>(() => readAutoPromptDismissed());
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandaloneMode());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(display-mode: standalone)');
    const updateStandalone = () => setIsStandalone(detectStandaloneMode());
    updateStandalone();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateStandalone);
    } else {
      media.addListener(updateStandalone);
    }

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', updateStandalone);
      } else {
        media.removeListener(updateStandalone);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as DeferredInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setAutoPromptDismissed(false);
      persistAutoPromptDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!import.meta.env.PROD) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      }).catch(() => {
        // ignore service worker registration errors
      });
      if ('caches' in window) {
        void caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key);
          });
        }).catch(() => {
          // ignore cache clear errors
        });
      }
      return;
    }

    if (!window.isSecureContext) return;
    void navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // ignore service worker registration errors
    });
  }, []);

  const dismissAutoPrompt = useCallback(() => {
    setAutoPromptDismissed(true);
    persistAutoPromptDismissed(true);
  }, []);

  const requestInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (isStandalone) return 'unavailable';
    if (!deferredPrompt) return 'unavailable';

    setDeferredPrompt(null);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
  }, [deferredPrompt, isStandalone]);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      isStandalone,
      canPromptInstall: !!deferredPrompt,
      canInstall: !isStandalone,
      shouldAutoPrompt: !isStandalone && !!deferredPrompt && !autoPromptDismissed,
      requestInstall,
      dismissAutoPrompt,
    }),
    [autoPromptDismissed, deferredPrompt, dismissAutoPrompt, isStandalone, requestInstall]
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }
  return context;
}
