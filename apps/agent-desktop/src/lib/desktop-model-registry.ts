import {
  LiveModelRegistry,
  type RegistryProviderSource,
} from '@svton/agent-app';
import type { ModelKey } from '@svton/agent-client';
import type { SvtonConfig } from './config-store';

export function toDesktopRegistrySources(
  config: SvtonConfig,
): RegistryProviderSource[] {
  return Object.entries(config.providers).map(([id, provider]) => ({
    id,
    name: id,
    type: provider.type,
    source: 'configured',
    models: Object.entries(provider.models ?? {}).map(([modelId, name]) => ({
      id: modelId,
      name: name || modelId,
    })),
  }));
}

export function createDesktopModelRegistry(
  config?: SvtonConfig | null,
): LiveModelRegistry {
  return new LiveModelRegistry(config ? toDesktopRegistrySources(config) : []);
}

export function desktopConfiguredModelKey(config: SvtonConfig): ModelKey {
  return {
    providerId: config.model.provider,
    modelId: config.model.name,
  };
}
