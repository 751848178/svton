import { useSyncExternalStore } from 'react';
import type { LiveModelRegistry, ModelRegistrySnapshot } from './model-registry';

export function useModelRegistry(registry: LiveModelRegistry): ModelRegistrySnapshot {
  return useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  );
}
