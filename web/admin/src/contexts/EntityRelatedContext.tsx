import { createContext, useContext, useState, useCallback } from 'react';
import { EntityRelatedDrawer } from '../components/EntityRelatedDrawer/EntityRelatedDrawer';
import type { Actor, Creator, Tag } from '../api/types';

type DrawerEntityType = 'actor' | 'creator' | 'tag';

interface EntityRelatedContextValue {
  openRelatedDrawer: (entityType: DrawerEntityType, entity: Actor | Creator | Tag) => void;
}

const EntityRelatedContext = createContext<EntityRelatedContextValue | null>(null);

export function EntityRelatedProvider({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<Actor | Creator | Tag | null>(null);
  const [drawerType, setDrawerType] = useState<DrawerEntityType | null>(null);

  const openRelatedDrawer = useCallback((entityType: DrawerEntityType, entity: Actor | Creator | Tag) => {
    setDrawerType(entityType);
    setDrawerEntity(entity);
    setDrawerOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <EntityRelatedContext.Provider value={{ openRelatedDrawer }}>
      {children}
      {drawerType && drawerEntity && (
        <EntityRelatedDrawer
          entityType={drawerType}
          entity={drawerEntity}
          open={drawerOpen}
          onClose={handleClose}
        />
      )}
    </EntityRelatedContext.Provider>
  );
}

export function useEntityRelated() {
  const ctx = useContext(EntityRelatedContext);
  return ctx;
}
