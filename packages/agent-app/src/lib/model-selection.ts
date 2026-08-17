import { decodeModelKey, encodeModelKey } from '@svton/agent-client';
import type { ModelOption, ProviderConfig } from '../types';

export interface ParsedModelKey {
  providerId?: string;
  modelId: string;
}

export function getProviderId(provider: Pick<ProviderConfig, 'name' | 'type'>): string {
  return provider.name || provider.type;
}

export function createModelKey(providerId: string, modelId: string): string {
  return encodeModelKey({ providerId, modelId });
}

export function parseModelKey(value: string): ParsedModelKey {
  const structured = decodeModelKey(value);
  if (structured) return structured;
  return { modelId: value };
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
      hidden: model.hidden,
      reasoningEfforts: model.reasoningEfforts,
      defaultReasoningEffort: model.defaultReasoningEffort,
    }));
  });
}

export function findProviderForModel(
  providers: ProviderConfig[],
  selectedModel: string,
): { provider?: ProviderConfig; modelId: string } {
  const structured = decodeModelKey(selectedModel);
  if (structured) {
    return {
      provider: providers.find((provider) =>
        getProviderId(provider) === structured.providerId
        && provider.models.some((model) => model.id === structured.modelId)),
      modelId: structured.modelId,
    };
  }
  const exactLegacy = providers.flatMap((provider) => {
    const providerId = getProviderId(provider);
    return provider.models
      .filter((model) => `${providerId}::${model.id}` === selectedModel)
      .map((model) => ({ provider, modelId: model.id }));
  });
  if (exactLegacy.length === 1) return exactLegacy[0];
  const bare = providers.flatMap((provider) =>
    provider.models.filter((model) => model.id === selectedModel)
      .map(() => provider));
  if (bare.length === 1) return { provider: bare[0], modelId: selectedModel };
  if (selectedModel) return { modelId: selectedModel };
  const provider = providers.find((candidate) => candidate.apiKey) ?? providers[0];
  return { provider, modelId: provider?.models[0]?.id ?? '' };
}
