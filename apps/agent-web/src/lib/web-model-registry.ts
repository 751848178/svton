import {
  LiveModelRegistry,
  type RegistryProviderSource,
} from '@svton/agent-app';
import { encodeModelKey, type ModelKey } from '@svton/agent-client';
import {
  DEFAULT_PROVIDERS,
  LS_DEFAULT_MODEL,
  LS_SETTINGS,
  loadSettings,
  saveString,
  type ProviderSetting,
} from './settings-store';

export function toWebRegistrySources(
  providers: readonly ProviderSetting[],
  source: 'configured' | 'bootstrap' = 'configured',
): RegistryProviderSource[] {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    source,
    models: provider.models,
  }));
}

export function createWebModelRegistry(): LiveModelRegistry {
  const configured = typeof window !== 'undefined' && localStorage.getItem(LS_SETTINGS) !== null;
  const providers = configured ? loadSettings() : DEFAULT_PROVIDERS;
  return new LiveModelRegistry(
    toWebRegistrySources(providers, configured ? 'configured' : 'bootstrap'),
  );
}

export function loadWebModelKey(registry: LiveModelRegistry): ModelKey | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LS_DEFAULT_MODEL);
  const resolved = registry.resolve(stored);
  if (resolved && stored !== encodeModelKey(resolved)) {
    saveString(LS_DEFAULT_MODEL, encodeModelKey(resolved));
  }
  return resolved;
}
