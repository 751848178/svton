import type { ProviderInfo } from '@svton/agent-ui';
import type { SvtonConfig } from './config-store';

type ConfigProviders = SvtonConfig['providers'];

export function toProviderInfoList(
  providers: ConfigProviders,
): ProviderInfo[] {
  return Object.entries(providers).map(([name, provider]) => ({
    id: name,
    name,
    type: provider.type,
    baseUrl: provider.base_url,
    apiKey: provider.api_key,
    models: Object.entries(provider.models || {}).map(([id, displayName]) => ({
      id,
      name: displayName || id,
    })),
  }));
}

export function toConfigProviders(
  current: ConfigProviders,
  providers: ProviderInfo[],
): ConfigProviders {
  const mapped: ConfigProviders = {};
  for (const provider of providers) {
    const models = Object.fromEntries(
      provider.models.map((model) => [model.id, model.name]),
    );
    const existing = current[provider.name] || current[provider.id];
    mapped[provider.name] = {
      type: (existing?.type || provider.type) as 'openai' | 'anthropic',
      api: existing?.api,
      base_url: provider.baseUrl,
      api_key: provider.apiKey,
      models,
    };
  }
  return mapped;
}
