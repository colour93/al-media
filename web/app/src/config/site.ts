import { API_BASE } from './api';

export interface SiteConfig {
  name: string;
  shortName: string;
  favicon: string;
  pwaIcon: string;
  pwaMaskableIcon: string;
  pwaThemeColor: string;
  pwaBackgroundColor: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  name: 'AL Media',
  shortName: 'AL Media',
  favicon: '/icons/app-icon.svg',
  pwaIcon: '/icons/app-icon.svg',
  pwaMaskableIcon: '/icons/app-icon-maskable.svg',
  pwaThemeColor: '#1976d2',
  pwaBackgroundColor: '#0b1220',
};

const BACKEND_MANIFEST_URL = `${API_BASE}/auth/manifest.webmanifest`;

function readConfigValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

export function normalizeSiteConfig(input?: Partial<SiteConfig> | null): SiteConfig {
  const name = readConfigValue(input?.name, DEFAULT_SITE_CONFIG.name);
  const shortName = readConfigValue(input?.shortName, name);
  const favicon = readConfigValue(input?.favicon, DEFAULT_SITE_CONFIG.favicon);
  const pwaIcon = readConfigValue(input?.pwaIcon, favicon);
  const pwaMaskableIcon = readConfigValue(input?.pwaMaskableIcon, pwaIcon);
  const pwaThemeColor = readConfigValue(input?.pwaThemeColor, DEFAULT_SITE_CONFIG.pwaThemeColor);
  const pwaBackgroundColor = readConfigValue(input?.pwaBackgroundColor, DEFAULT_SITE_CONFIG.pwaBackgroundColor);

  return {
    name,
    shortName,
    favicon,
    pwaIcon,
    pwaMaskableIcon,
    pwaThemeColor,
    pwaBackgroundColor,
  };
}

function upsertLinkElement(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function upsertMetaElement(name: string, content: string) {
  let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

export function applySiteConfigToHead(site: SiteConfig) {
  if (typeof document === 'undefined') return;
  document.title = site.name;
  upsertLinkElement('icon', site.favicon);
  upsertLinkElement('manifest', BACKEND_MANIFEST_URL);
  upsertMetaElement('theme-color', site.pwaThemeColor);
}
