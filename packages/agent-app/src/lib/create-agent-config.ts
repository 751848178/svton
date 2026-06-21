/**
 * createAgentConfig — wires all tools, managers, and skills.
 * Extracted from agent-web's initAgentConfig for reuse.
 */

import {
  ToolRegistry,
  OpenAIProvider,
  AnthropicProvider,
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
  csvFanoutDef,
  CsvFanoutExecutor,
  codeReviewSkill,
  SkillManager,
  MemoryManager,
  PromptManager,
  PermissionManager,
  HookManager,
  PlanningManager,
  SessionResumeManager,
  AgentDefinitionManager,
  ImageGenRegistry,
  OpenAIImageProvider,
  StabilityProvider,
  GoogleImagenProvider,
  MCPClient,
  HTTPTransport,
  SSETransport,
  PluginManager,
  IntegrationManager,
  SkillLoader,
  type AgentConfig,
  type AgentCapabilities,
  type McpServerToolConfig,
  type ModelInfo,
} from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { ProviderConfig, FeatureFlags, McpServerEntry, ImageProviderConfig, IntegrationConfig, MarketplaceConfig } from '../types';
import { BUILTIN_SKILLS } from './builtin-skills';
import { createAgentAppStorage, type AgentAppStorage } from './storage';
import { resolveAgentAppIntegrationManifests } from './integrations';
import { findProviderForModel } from './model-selection';

const STORAGE_KEYS = {
  stabilityKey: 'stabilityKey',
  googleKey: 'googleKey',
  disabledTools: 'disabledTools',
  disabledSkills: 'disabledSkills',
  permissionMode: 'permissionMode',
  customInstructions: 'customInstructions',
};

function loadString(storage: AgentAppStorage, key: string): string {
  return storage.getString(key);
}

function loadJsonList(storage: AgentAppStorage, key: string): string[] {
  const value = storage.getJson<unknown>(key, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
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

export interface CreateAgentConfigOptions {
  providers: ProviderConfig[];
  model: string;
  platform: BrowserPlatform;
  features?: FeatureFlags;
  searchEndpoint?: string;
  systemPrompt?: string;
  workingDir?: string;
  skills?: import('@svton/agent-core').SkillDefinition[];
  mcpServers?: McpServerEntry[];
  imageProviders?: ImageProviderConfig;
  storageNamespace?: string;
  integrations?: IntegrationConfig;
  marketplace?: MarketplaceConfig;
  maxIterations?: number;
  contextConfig?: AgentConfig['contextConfig'];
}

export async function createAgentConfig(opts: CreateAgentConfigOptions): Promise<AgentConfig> {
  const {
    providers,
    model,
    platform,
    features = {},
    searchEndpoint,
    systemPrompt,
    workingDir = '/',
    skills = [],
    mcpServers = [],
    imageProviders,
    storageNamespace,
    integrations,
    maxIterations,
    contextConfig,
  } = opts;
  const appStorage = createAgentAppStorage(storageNamespace);
  // Find the provider that owns the selected model
  const { provider: providerCfg, modelId: requestedModelId } = findProviderForModel(providers, model);

  if (!providerCfg) throw new Error('No provider configured');

  const selectedModel = requestedModelId || providerCfg.models[0]?.id || 'gpt-4o';

  // Build model infos
  const modelInfos = providerCfg.models.map(toModelInfo);

  // Create provider
  const provider = providerCfg.provider
    ?? providerCfg.createProvider?.(providerCfg, modelInfos)
    ?? (providerCfg.type === 'anthropic'
      ? new AnthropicProvider({ baseUrl: providerCfg.baseUrl || undefined, apiKey: providerCfg.apiKey || '', models: modelInfos })
      : new OpenAIProvider({ name: providerCfg.name || providerCfg.type, baseUrl: providerCfg.baseUrl || 'https://api.openai.com', apiKey: providerCfg.apiKey || '', models: modelInfos }));

  // ── Tool Registry ──
  const toolRegistry = new ToolRegistry();

  // Web tools
  if (features.webFetch !== false) {
    toolRegistry.register(webFetchDef, new WebFetchExecutor());
  }
  if (features.webSearch !== false && searchEndpoint) {
    toolRegistry.register(webSearchDef, new WebSearchExecutor(searchEndpoint));
  }

  // Memory
  const memoryManager = features.memory === false ? undefined : new MemoryManager();
  if (memoryManager) {
    await memoryManager.init(platform.storage);
    toolRegistry.register(memorySaveDef, new MemorySaveExecutor(memoryManager));
    toolRegistry.register(memoryRecallDef, new MemoryRecallExecutor(memoryManager));
  }

  // Planning
  const planningManager = features.planning === false ? undefined : new PlanningManager();
  if (planningManager) {
    await planningManager.init(platform.storage);
    toolRegistry.register(planCreateDef, new PlanCreateExecutor(planningManager));
    toolRegistry.register(planGetStatusDef, new PlanGetStatusExecutor(planningManager));
    toolRegistry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planningManager));
  }

  // Session Resume
  const resumeManager = features.sessionResume === false
    ? undefined
    : new SessionResumeManager(platform.storage);

  // Agent Definitions
  const agentDefinitionManager = features.agentDefinitions === false
    ? undefined
    : new AgentDefinitionManager(platform.storage);
  if (agentDefinitionManager) {
    await agentDefinitionManager.loadFromStorage();
    for (const def of agentDefinitionManager.getBuiltinDefaults()) {
      agentDefinitionManager.register(def);
    }
  }

  // Image Generation
  const imageGenRegistry = new ImageGenRegistry();
  if (features.imageGeneration !== false && providerCfg.type === 'openai' && providerCfg.apiKey) {
    imageGenRegistry.register(new OpenAIImageProvider(), providerCfg.apiKey);
  }
  const stabilityKey = imageProviders?.stabilityKey || loadString(appStorage, STORAGE_KEYS.stabilityKey);
  if (features.imageGeneration !== false && stabilityKey) {
    imageGenRegistry.register(new StabilityProvider(), stabilityKey);
  }
  const googleKey = imageProviders?.googleKey || loadString(appStorage, STORAGE_KEYS.googleKey);
  if (features.imageGeneration !== false && googleKey) {
    imageGenRegistry.register(new GoogleImagenProvider('svton-agent'), googleKey);
  }
  if (features.imageGeneration !== false) {
    toolRegistry.register(imageGenerateDef, new ImageGenerateExecutor(imageGenRegistry));
  }

  // Code Review
  if (features.codeReview !== false) {
    toolRegistry.register(gitDiffDef, new GitDiffExecutor());
    toolRegistry.register(gitLogRangeDef, new GitLogRangeExecutor());
  }

  // Document Preview
  if (features.documentPreview !== false) {
    toolRegistry.register(previewDocumentDef, new PreviewDocumentExecutor());
  }

  // CSV Fan-out (needs subagent, registered later by ChatService)
  // csvFanoutDef will be registered by ChatService when SubagentManager is created

  // Skills
  const skillManager = new SkillManager();

  // Register built-in skills (compiled into the package)
  for (const skill of BUILTIN_SKILLS) {
    skillManager.register(skill);
  }

  // Also discover from platform storage / working dir
  const { skills: discoveredSkills } = await SkillLoader.discover(
    platform.storage,
    platform,
    [],
    workingDir,
  );
  for (const skill of discoveredSkills) {
    skillManager.register(skill);
  }
  if (features.codeReview !== false) {
    skillManager.register(codeReviewSkill);
  }
  for (const skill of skills) {
    skillManager.register(skill);
  }

  // Filter disabled tools/skills
  const disabledTools = loadJsonList(appStorage, STORAGE_KEYS.disabledTools);
  for (const name of disabledTools) toolRegistry.unregister(name);
  const disabledSkills = loadJsonList(appStorage, STORAGE_KEYS.disabledSkills);
  for (const name of disabledSkills) skillManager.unregister(name);

  // Permission mode
  const savedMode = loadString(appStorage, STORAGE_KEYS.permissionMode) as any || 'default';
  const permissionManager = new PermissionManager({ mode: savedMode });

  // Prompt
  const promptManager = new PromptManager();
  if (systemPrompt) {
    promptManager.addInstructions(systemPrompt);
  }

  const hookManager = new HookManager();

  // Integrations (browser-safe HTTP APIs)
  const integrationManifests = features.integrations === false ? [] : resolveAgentAppIntegrationManifests(integrations);
  if (integrationManifests.length > 0) {
    const integrationManager = new IntegrationManager(platform.storage);
    for (const manifest of integrationManifests) {
      integrationManager.registerManifest(manifest);
    }
    await integrationManager.init();
    for (const { definition, executor } of integrationManager.resolveAllTools()) {
      toolRegistry.register(definition, executor);
    }
  }

  // MCP servers (HTTP/SSE only in browser)
  const capabilities: AgentCapabilities & { csvFanoutEnabled?: boolean } = {
    skillManager,
    memoryManager,
    promptManager,
    permissionManager,
    hookManager,
    planningManager,
    resumeManager,
    agentDefinitionManager,
    csvFanoutEnabled: features.csvFanout !== false,
  };

  const mcpClients: import('@svton/agent-core').MCPClient[] = [];
  const mcpServerConfigs = new Map<string, McpServerToolConfig>();
  const connectedMcpKeys = new Set<string>();
  for (const cfg of mcpServers) {
    if (cfg.enabled === false || !cfg.url) continue;
    const key = `${cfg.type || 'http'}:${cfg.url}`;
    if (connectedMcpKeys.has(key)) continue;
    try {
      const client = new MCPClient();
      const transport = cfg.type === 'sse'
        ? new SSETransport({ url: cfg.url, headers: cfg.headers })
        : new HTTPTransport({ url: cfg.url, headers: cfg.headers });
      await client.connect(transport);
      mcpClients.push(client);
      connectedMcpKeys.add(key);
      const serverName = client.info?.name || cfg.name;
      if (cfg.approvalMode || cfg.enabledTools?.length || cfg.disabledTools?.length) {
        mcpServerConfigs.set(serverName, {
          approvalMode: cfg.approvalMode,
          enabledTools: cfg.enabledTools,
          disabledTools: cfg.disabledTools,
        });
      }
    } catch (err) {
      console.error(`[agent-app] MCP server "${cfg.name}" connection failed:`, err);
    }
  }

  if (mcpClients.length > 0) {
    capabilities.mcpClients = mcpClients;
  }

  if (features.plugins !== false) {
    const pluginManager = new PluginManager();
    await pluginManager.init(platform.storage);
    capabilities.pluginManager = pluginManager;
    for (const plugin of pluginManager.getEnabledPlugins()) {
      if (!plugin.manifest.mcpServers?.length) continue;
      for (const mcp of plugin.manifest.mcpServers) {
        if (mcp.enabled === false || mcp.transport === 'stdio' || !mcp.url) continue;
        const key = `http:${mcp.url}`;
        if (connectedMcpKeys.has(key)) continue;
        try {
          const client = new MCPClient();
          const transport = new HTTPTransport({ url: mcp.url });
          await client.connect(transport);
          mcpClients.push(client);
          connectedMcpKeys.add(key);
          if (mcp.approvalMode) {
            mcpServerConfigs.set(client.info?.name || mcp.name, {
              approvalMode: mcp.approvalMode,
            });
          }
        } catch (err) {
          console.error(`[agent-app] Plugin "${plugin.name}" MCP "${mcp.name}" failed:`, err);
        }
      }
      capabilities.mcpClients = mcpClients;
    }
  }
  if (mcpServerConfigs.size > 0) {
    capabilities.mcpServerConfigs = mcpServerConfigs;
  }

  // Custom instructions
  const customInstructions = loadString(appStorage, STORAGE_KEYS.customInstructions);

  return {
    provider,
    model: selectedModel,
    toolRegistry,
    workingDir,
    capabilities,
    maxIterations,
    contextConfig: contextConfig ?? {
      maxTokens: 128000,
      compactionThreshold: 0.8,
      preserveRecentMessages: 6,
    },
    ...(customInstructions ? { systemPrompt: `\n\n### Custom Instructions\n${customInstructions}` } : {}),
  };
}
