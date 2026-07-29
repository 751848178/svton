import {
  createPiModelsForProvider,
  type PiModelsHandle,
  type Provider,
  type ModelInfo,
} from '@svton/agent-core';
import type { ProviderConfig } from '../types';
import { findProviderForModel } from './model-selection';

export interface ResolvedAgentModel extends PiModelsHandle {
  provider: ProviderConfig;
  selectedModel: string;
}

function toModelInfo(model: ProviderConfig['models'][number]): ModelInfo {
  return {
    id: model.id,
    name: model.name,
    contextWindow: model.contextWindow ?? 128000,
    supportsToolUse: model.supportsToolUse ?? true,
    supportsVision: model.supportsVision ?? false,
    supportsStreaming: model.supportsStreaming ?? true,
    supportsThinking: model.supportsThinking,
  };
}

export function resolveAgentModel(
  providers: ProviderConfig[],
  requestedModel: string,
  piProvider?: Provider,
): ResolvedAgentModel {
  const { provider, modelId } = findProviderForModel(providers, requestedModel);
  if (!provider) throw new Error('No provider configured');

  const selectedModel = modelId || provider.models[0]?.id || 'gpt-4o';
  const handle = createPiModelsForProvider(selectedModel, {
    family: provider.type === 'anthropic' ? 'anthropic' : 'openai',
    apiKey: provider.apiKey || undefined,
    baseUrl: provider.baseUrl || undefined,
    models: provider.models.map(toModelInfo),
    piProvider,
  });

  return { ...handle, provider, selectedModel };
}
