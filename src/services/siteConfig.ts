export type PublicSiteConfig = {
  name: string;
  shortName: string;
  favicon: string;
  pwaIcon: string;
  pwaMaskableIcon: string;
  pwaThemeColor: string;
  pwaBackgroundColor: string;
};

const DEFAULT_SITE_NAME = "AL Media";
const DEFAULT_SITE_SHORT_NAME = "AL Media";
const DEFAULT_SITE_FAVICON = "/icons/app-icon.svg";
const DEFAULT_PWA_THEME_COLOR = "#1976d2";
const DEFAULT_PWA_BACKGROUND_COLOR = "#0b1220";

function readEnvString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function normalizeAssetPath(value: string): string {
  if (!value) return value;
  if (value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  return `/${value}`;
}

function inferIconMimeType(iconUrl: string): string {
  const lower = iconUrl.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "image/png";
}

export function getPublicSiteConfig(): PublicSiteConfig {
  const name = readEnvString(process.env.SITE_NAME, DEFAULT_SITE_NAME);
  const shortName = readEnvString(process.env.SITE_SHORT_NAME, name || DEFAULT_SITE_SHORT_NAME);
  const favicon = normalizeAssetPath(readEnvString(process.env.SITE_FAVICON, DEFAULT_SITE_FAVICON));
  const pwaIcon = normalizeAssetPath(readEnvString(process.env.PWA_ICON, favicon));
  const pwaMaskableIcon = normalizeAssetPath(readEnvString(process.env.PWA_MASKABLE_ICON, pwaIcon));
  const pwaThemeColor = readEnvString(process.env.PWA_THEME_COLOR, DEFAULT_PWA_THEME_COLOR);
  const pwaBackgroundColor = readEnvString(process.env.PWA_BACKGROUND_COLOR, DEFAULT_PWA_BACKGROUND_COLOR);

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

export function getPublicSiteManifest() {
  const site = getPublicSiteConfig();
  return {
    name: site.name,
    short_name: site.shortName,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: site.pwaBackgroundColor,
    theme_color: site.pwaThemeColor,
    description: `${site.name} 应用`,
    icons: [
      {
        src: site.pwaIcon,
        sizes: "any",
        type: inferIconMimeType(site.pwaIcon),
        purpose: "any",
      },
      {
        src: site.pwaMaskableIcon,
        sizes: "any",
        type: inferIconMimeType(site.pwaMaskableIcon),
        purpose: "maskable",
      },
    ],
  };
}
