import { useContext } from 'react';
import { EntityRelatedContext } from '../contexts/entityRelatedStore';

export function useEntityRelated() {
  return useContext(EntityRelatedContext);
}
