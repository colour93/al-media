import {
  Tags,
  User,
  Users,
  Film,
  Heart,
  Star,
  Camera,
  Image,
  Music,
  Bookmark,
  Folder,
  FileVideo,
  Sparkles,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import { createElement, type ReactNode } from 'react';

export const LUCIDE_ICON_OPTIONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'Tags', Icon: Tags },
  { name: 'User', Icon: User },
  { name: 'Users', Icon: Users },
  { name: 'Film', Icon: Film },
  { name: 'Heart', Icon: Heart },
  { name: 'Star', Icon: Star },
  { name: 'Camera', Icon: Camera },
  { name: 'Image', Icon: Image },
  { name: 'Music', Icon: Music },
  { name: 'Bookmark', Icon: Bookmark },
  { name: 'Folder', Icon: Folder },
  { name: 'FileVideo', Icon: FileVideo },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Palette', Icon: Palette },
];

export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  LUCIDE_ICON_OPTIONS.map(({ name, Icon }) => [name, Icon])
);

const iconNamesSet = new Set<IconName>(iconNames);

function isDynamicIconName(name: string): name is IconName {
  return iconNamesSet.has(name as IconName);
}

export function getLucideIcon(name: string | null): LucideIcon | null {
  if (!name) return null;
  return LUCIDE_ICON_MAP[name] ?? null;
}

/** 渲染 Lucide 图标，支持任意有效图标名（优先静态映射，否则用 DynamicIcon） */
export function renderLucideIcon(
  name: string | null,
  props?: { size?: number; className?: string }
): ReactNode {
  if (!name) return null;
  const Icon = LUCIDE_ICON_MAP[name];
  if (Icon) {
    return createElement(Icon, { size: props?.size ?? 16, ...props });
  }
  if (isDynamicIconName(name)) {
    return createElement(DynamicIcon, { name, size: props?.size ?? 16, ...props });
  }
  return null;
}
