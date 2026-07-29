/**
 * Assemble the reusable AgentApp runtime configuration from host inputs.
 */

import type {
  AgentConfig,
  Provider,
  SkillDefinition,
} from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type {
  FeatureFlags,
  ImageProviderConfig,
  IntegrationConfig,
  MarketplaceConfig,
  McpServerEntry,
  ProviderConfig,
} from '../types';
import { createAgentCapabilities } from './agent-config-capabilities.service';
import { resolveAgentModel } from './agent-config-model.utils';
import {
  AGENT_CONFIG_STORAGE_KEYS,
  loadStoredString,
} from './agent-config-storage.utils';
import { createAgentToolRegistry } from './agent-config-tool-registry.service';
import { createAgentAppStorage } from './storage';

export interface CreateAgentConfigOptions {
  providers: ProviderConfig[];
  model: string;
  platform: BrowserPlatform;
  features?: FeatureFlags;
  searchEndpoint?: string;
  /** Tavily API key for the hosted web-search backend. */
  searchApiKey?: string;
  systemPrompt?: string;
  workingDir?: string;
  skills?: SkillDefinition[];
  /** Storage/public paths searched for additional skills. */
  skillPaths?: string[];
  /** Register AgentApp's bundled skills before discovery. Defaults to true. */
  registerBuiltinSkills?: boolean;
  mcpServers?: McpServerEntry[];
  imageProviders?: ImageProviderConfig;
  storageNamespace?: string;
  integrations?: IntegrationConfig;
  marketplace?: MarketplaceConfig;
  maxIterations?: number;
  contextConfig?: AgentConfig['contextConfig'];
  /** Advanced deterministic provider injection used by product E2E. */
  piProvider?: Provider;
}

export async function createAgentConfig(
  options: CreateAgentConfigOptions,
): Promise<AgentConfig> {
  const {
    providers,
    model,
    platform,
    features = {},
    searchEndpoint,
    searchApiKey,
    systemPrompt,
    workingDir = '/',
    skills = [],
    skillPaths = [],
    registerBuiltinSkills = true,
    mcpServers = [],
    imageProviders,
    storageNamespace,
    integrations,
    maxIterations,
    contextConfig,
    piProvider,
  } = options;
  const storage = createAgentAppStorage(storageNamespace);
  const resolvedModel = resolveAgentModel(providers, model, piProvider);
  const toolSetup = await createAgentToolRegistry({
    platform,
    features,
    provider: resolvedModel.provider,
    searchEndpoint,
    searchApiKey,
    imageProviders,
    storage,
  });
  const capabilities = await createAgentCapabilities({
    platform,
    features,
    ...toolSetup,
    storage,
    workingDir,
    systemPrompt,
    skills,
    skillPaths,
    registerBuiltinSkills,
    mcpServers,
    integrations,
  });
  const customInstructions = loadStoredString(
    storage,
    AGENT_CONFIG_STORAGE_KEYS.customInstructions,
  );

  return {
    models: resolvedModel.models,
    piModel: resolvedModel.model,
    model: resolvedModel.selectedModel,
    toolRegistry: toolSetup.toolRegistry,
    workingDir,
    capabilities,
    maxIterations,
    contextConfig: contextConfig ?? {
      maxTokens: 128000,
      compactionThreshold: 0.8,
      preserveRecentMessages: 6,
    },
    ...(customInstructions
      ? { systemPrompt: `\n\n### Custom Instructions\n${customInstructions}` }
      : {}),
  };
}
