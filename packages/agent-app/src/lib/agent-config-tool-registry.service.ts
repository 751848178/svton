import {
  ToolRegistry,
  webFetchDef,
  WebFetchExecutor,
  webSearchDef,
  WebSearchExecutor,
  memorySaveDef,
  MemorySaveExecutor,
  memoryRecallDef,
  MemoryRecallExecutor,
  planCreateDef,
  PlanCreateExecutor,
  planGetStatusDef,
  PlanGetStatusExecutor,
  planUpdateStepDef,
  PlanUpdateStepExecutor,
  gitDiffDef,
  GitDiffExecutor,
  gitLogRangeDef,
  GitLogRangeExecutor,
  imageGenerateDef,
  ImageGenerateExecutor,
  previewDocumentDef,
  PreviewDocumentExecutor,
  ImageGenRegistry,
  OpenAIImageProvider,
  StabilityProvider,
  GoogleImagenProvider,
  MemoryManager,
  PlanningManager,
} from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type {
  FeatureFlags,
  ImageProviderConfig,
  ProviderConfig,
} from '../types';
import {
  AGENT_CONFIG_STORAGE_KEYS,
  loadStoredString,
} from './agent-config-storage.utils';
import type { AgentAppStorage } from './storage';

export interface AgentToolRegistryOptions {
  platform: BrowserPlatform;
  features: FeatureFlags;
  provider: ProviderConfig;
  searchEndpoint?: string;
  searchApiKey?: string;
  imageProviders?: ImageProviderConfig;
  storage: AgentAppStorage;
}

export interface AgentToolRegistryResult {
  toolRegistry: ToolRegistry;
  memoryManager?: MemoryManager;
  planningManager?: PlanningManager;
}

export async function createAgentToolRegistry(
  options: AgentToolRegistryOptions,
): Promise<AgentToolRegistryResult> {
  const {
    platform,
    features,
    provider,
    searchEndpoint,
    searchApiKey,
    imageProviders,
    storage,
  } = options;
  const toolRegistry = new ToolRegistry();

  if (features.webFetch !== false) {
    toolRegistry.register(webFetchDef, new WebFetchExecutor());
  }
  if (features.webSearch !== false) {
    const searchExecutor = searchApiKey
      ? new WebSearchExecutor({ provider: 'tavily', apiKey: searchApiKey })
      : searchEndpoint
        ? new WebSearchExecutor(searchEndpoint)
        : null;
    if (searchExecutor) {
      toolRegistry.register(webSearchDef, searchExecutor);
    }
  }

  const memoryManager = features.memory === false
    ? undefined
    : new MemoryManager();
  if (memoryManager) {
    await memoryManager.init(platform.storage);
    toolRegistry.register(memorySaveDef, new MemorySaveExecutor(memoryManager));
    toolRegistry.register(memoryRecallDef, new MemoryRecallExecutor(memoryManager));
  }

  const planningManager = features.planning === false
    ? undefined
    : new PlanningManager();
  if (planningManager) {
    await planningManager.init(platform.storage);
    toolRegistry.register(planCreateDef, new PlanCreateExecutor(planningManager));
    toolRegistry.register(planGetStatusDef, new PlanGetStatusExecutor(planningManager));
    toolRegistry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planningManager));
  }

  if (features.imageGeneration !== false) {
    const imageRegistry = new ImageGenRegistry();
    if (provider.type === 'openai' && provider.apiKey) {
      imageRegistry.register(new OpenAIImageProvider(), provider.apiKey);
    }
    const stabilityKey = imageProviders?.stabilityKey
      || loadStoredString(storage, AGENT_CONFIG_STORAGE_KEYS.stabilityKey);
    if (stabilityKey) {
      imageRegistry.register(new StabilityProvider(), stabilityKey);
    }
    const googleKey = imageProviders?.googleKey
      || loadStoredString(storage, AGENT_CONFIG_STORAGE_KEYS.googleKey);
    if (googleKey) {
      imageRegistry.register(new GoogleImagenProvider('svton-agent'), googleKey);
    }
    toolRegistry.register(imageGenerateDef, new ImageGenerateExecutor(imageRegistry));
  }

  if (features.codeReview !== false) {
    toolRegistry.register(gitDiffDef, new GitDiffExecutor());
    toolRegistry.register(gitLogRangeDef, new GitLogRangeExecutor());
  }
  if (features.documentPreview !== false) {
    toolRegistry.register(previewDocumentDef, new PreviewDocumentExecutor());
  }

  return { toolRegistry, memoryManager, planningManager };
}
