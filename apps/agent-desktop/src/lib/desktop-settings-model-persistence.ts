import type { TauriPlatform } from '@svton/agent-platform';
import type { ProviderInfo } from '@svton/agent-ui';
import { decodeModelKey, encodeModelKey } from '@svton/agent-client';
import type { LiveModelRegistry } from '@svton/agent-app';
import { saveConfig, type SvtonConfig } from './config-store';
import { toConfigProviders, toProviderInfoList } from './provider-settings.utils';
import { toDesktopRegistrySources } from './desktop-model-registry';

export function readDesktopProviders(config: SvtonConfig | null): ProviderInfo[] {
  return config ? toProviderInfoList(config.providers) : [];
}

export function updateDesktopProviders(
  config: SvtonConfig | null,
  providers: ProviderInfo[],
): SvtonConfig | null {
  if (!config) return null;
  return { ...config, providers: toConfigProviders(config.providers, providers) };
}

export async function persistDesktopProviders(
  platform: TauriPlatform,
  config: SvtonConfig,
  registry?: LiveModelRegistry,
): Promise<void> {
  await saveConfig(platform, config);
  registry?.replace(toDesktopRegistrySources(config));
}

export function readDesktopDefaultModel(config: SvtonConfig | null): string {
  return config ? encodeModelKey({
    providerId: config.model.provider,
    modelId: config.model.name,
  }) : '';
}

export async function persistDesktopDefaultModel(
  platform: TauriPlatform,
  config: SvtonConfig | null,
  encodedKey: string,
): Promise<SvtonConfig | null> {
  if (!config) return null;
  const key = decodeModelKey(encodedKey);
  if (!key) throw new Error('模型标识无效，无法保存桌面默认模型。');
  const provider = config.providers[key.providerId];
  if (!provider?.models || !(key.modelId in provider.models)) {
    throw new Error('模型不属于当前桌面 Provider 配置。');
  }
  const next = {
    ...config,
    model: { provider: key.providerId, name: key.modelId },
  };
  await saveConfig(platform, next);
  return next;
}
