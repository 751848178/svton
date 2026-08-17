import { decodeModelKey } from '@svton/agent-client';
import type { SvtonConfig } from './config-store';

export interface DesktopModelSelection {
  providerId: string;
  modelId: string;
}

export function resolveDesktopModelSelection(
  config: SvtonConfig,
  override?: string,
): DesktopModelSelection {
  if (!override) {
    return {
      providerId: config.model.provider,
      modelId: config.model.name,
    };
  }
  const structured = decodeModelKey(override);
  if (structured) {
    assertConfigured(config, structured.providerId, structured.modelId);
    return structured;
  }
  const legacy = Object.entries(config.providers).flatMap(([providerId, provider]) =>
    Object.keys(provider.models ?? {})
      .filter((modelId) => `${providerId}::${modelId}` === override)
      .map((modelId) => ({ providerId, modelId })));
  if (legacy.length === 1) return legacy[0];
  const bare = Object.entries(config.providers).flatMap(([providerId, provider]) =>
    Object.keys(provider.models ?? {})
      .filter((modelId) => modelId === override)
      .map((modelId) => ({ providerId, modelId })));
  if (bare.length === 1) return bare[0];
  throw new Error('模型标识无法唯一解析到桌面 Provider。');
}

function assertConfigured(
  config: SvtonConfig,
  providerId: string,
  modelId: string,
): void {
  const provider = config.providers[providerId];
  if (!provider) throw new Error(`Provider "${providerId}" not found in config`);
  if (!provider.models || !(modelId in provider.models)) {
    throw new Error(`Model "${modelId}" not found in Provider "${providerId}"`);
  }
}
