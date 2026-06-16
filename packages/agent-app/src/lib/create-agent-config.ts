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
  type AgentConfig,
  type AgentCapabilities,
} from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { ProviderConfig, FeatureFlags, McpServerEntry } from '../types';

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
    maxIterations,
    contextConfig,
  } = opts;

  // Find the provider that owns the selected model
  let providerCfg = providers.find(p => p.models.some(m => m.id === model))
    || providers.find(p => p.apiKey)
    || providers[0];

  if (!providerCfg) throw new Error('No provider configured');

  const selectedModel = model || providerCfg.models[0]?.id || 'gpt-4o';

  // Build model infos
  const modelInfos = providerCfg.models.map(m => ({
    id: m.id,
    name: m.name,
    contextWindow: m.contextWindow ?? 128000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
  }));

  // Create provider
  const provider = providerCfg.type === 'anthropic'
    ? new AnthropicProvider({ baseUrl: providerCfg.baseUrl || undefined, apiKey: providerCfg.apiKey, models: modelInfos })
    : new OpenAIProvider({ name: providerCfg.name || providerCfg.type, baseUrl: providerCfg.baseUrl || 'https://api.openai.com', apiKey: providerCfg.apiKey, models: modelInfos });

  // ── Tool Registry ──
  const toolRegistry = new ToolRegistry();

  // Web tools
  toolRegistry.register(webFetchDef, new WebFetchExecutor());
  if (features.webSearch !== false && searchEndpoint) {
    toolRegistry.register(webSearchDef, new WebSearchExecutor(searchEndpoint));
  }

  // Memory
  const memoryManager = new MemoryManager();
  await memoryManager.init(platform.storage);
  toolRegistry.register(memorySaveDef, new MemorySaveExecutor(memoryManager));
  toolRegistry.register(memoryRecallDef, new MemoryRecallExecutor(memoryManager));

  // Planning
  const planningManager = new PlanningManager();
  await planningManager.init(platform.storage);
  toolRegistry.register(planCreateDef, new PlanCreateExecutor(planningManager));
  toolRegistry.register(planGetStatusDef, new PlanGetStatusExecutor(planningManager));
  toolRegistry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planningManager));

  // Session Resume
  const resumeManager = new SessionResumeManager(platform.storage);

  // Agent Definitions
  const agentDefinitionManager = new AgentDefinitionManager(platform.storage);
  await agentDefinitionManager.loadFromStorage();
  for (const def of agentDefinitionManager.getBuiltinDefaults()) {
    agentDefinitionManager.register(def);
  }

  // Image Generation
  const imageGenRegistry = new ImageGenRegistry();
  if (features.imageGeneration !== false && providerCfg.type === 'openai' && providerCfg.apiKey) {
    imageGenRegistry.register(new OpenAIImageProvider(), providerCfg.apiKey);
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
  if (features.codeReview !== false) {
    skillManager.register(codeReviewSkill);
  }
  for (const skill of skills) {
    skillManager.register(skill);
  }

  // Filter disabled tools/skills
  const disabledTools = JSON.parse(localStorage.getItem('svton-app:disabledTools') || '[]');
  if (Array.isArray(disabledTools)) {
    for (const name of disabledTools) toolRegistry.unregister(name);
  }
  const disabledSkills = JSON.parse(localStorage.getItem('svton-app:disabledSkills') || '[]');
  if (Array.isArray(disabledSkills)) {
    for (const name of disabledSkills) skillManager.unregister(name);
  }

  // Permission mode
  const savedMode = localStorage.getItem('svton-app:permissionMode') as any || 'default';
  const permissionManager = new PermissionManager({ mode: savedMode });

  // Prompt
  const promptManager = new PromptManager();
  if (systemPrompt) {
    promptManager.addInstructions(systemPrompt);
  }

  const hookManager = new HookManager();

  // MCP servers (HTTP only)
  const capabilities: AgentCapabilities = {
    skillManager,
    memoryManager,
    promptManager,
    permissionManager,
    hookManager,
    planningManager,
    resumeManager,
    agentDefinitionManager,
  };

  // Custom instructions
  const customInstructions = localStorage.getItem('svton-app:customInstructions') || '';

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
