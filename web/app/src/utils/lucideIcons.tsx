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
import { createElement, type ReactNode } from 'react';

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
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
};

export function renderLucideIcon(name: string | null, props?: { size?: number }): ReactNode {
  if (!name) return null;
  const Icon = LUCIDE_ICON_MAP[name];
  if (Icon) {
    return createElement(Icon, { size: props?.size ?? 16, ...props });
  }
  return null;
}
