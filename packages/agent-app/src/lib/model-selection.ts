import type { ModelOption, ProviderConfig } from '../types';

export interface ParsedModelKey {
  providerId?: string;
  modelId: string;
}

export function getProviderId(provider: Pick<ProviderConfig, 'name' | 'type'>): string {
  return provider.name || provider.type;
}

export function createModelKey(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

export function parseModelKey(value: string): ParsedModelKey {
  if (!value.includes('::')) return { modelId: value };
  const [providerId, ...modelParts] = value.split('::');
  return {
    providerId,
    modelId: modelParts.join('::'),
  };
}

export function buildModelOptions(providers: ProviderConfig[]): ModelOption[] {
  return providers.flatMap((provider) => {
    const providerId = getProviderId(provider);
    return provider.models.map((model) => ({
      key: createModelKey(providerId, model.id),
      id: model.id,
      name: model.name,
      providerId,
      providerName: providerId,
      providerType: provider.type,
    }));
  });
}

export function findProviderForModel(
  providers: ProviderConfig[],
  selectedModel: string,
): { provider?: ProviderConfig; modelId: string } {
  const { providerId, modelId } = parseModelKey(selectedModel);
  const provider = providers.find((p) =>
    (!providerId || getProviderId(p) === providerId)
    && p.models.some((m) => m.id === modelId),
  )
    || providers.find((p) => p.apiKey || p.provider || p.createProvider)
    || providers[0];
  return { provider, modelId };
}
