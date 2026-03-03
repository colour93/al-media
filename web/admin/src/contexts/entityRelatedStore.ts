import { createContext } from 'react';
import type { Actor, Creator, Tag } from '../api/types';

export type DrawerEntityType = 'actor' | 'creator' | 'tag';

export interface EntityRelatedContextValue {
  openRelatedDrawer: (entityType: DrawerEntityType, entity: Actor | Creator | Tag) => void;
}

export const EntityRelatedContext = createContext<EntityRelatedContextValue | null>(null);
