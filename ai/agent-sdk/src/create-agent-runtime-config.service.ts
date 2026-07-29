import {
  BrowserPlatform,
  type IPlatform,
} from '@svton/agent-platform';
import {
  createPiModelsForProvider,
  createWebSearchExecutor,
  HookManager,
  MemoryManager,
  MemoryRecallExecutor,
  MemorySaveExecutor,
  memoryRecallDef,
  memorySaveDef,
  PermissionManager,
  PlanCreateExecutor,
  planCreateDef,
  PlanGetStatusExecutor,
  planGetStatusDef,
  PlanningManager,
  PlanUpdateStepExecutor,
  planUpdateStepDef,
  PromptManager,
  SessionResumeManager,
  SkillManager,
  ToolRegistry,
  WebFetchExecutor,
  webFetchDef,
  webSearchDef,
} from '@svton/agent-core';
import type {
  AgentConfig,
  HookEvent,
  HookHandler,
} from '@svton/agent-core';
import type { CreateAgentConfig } from './types';
import { FunctionToolExecutor } from './tool-adapter';
import { connectAgentMcpServers } from './create-agent-mcp.service';
import type { PreparedAgentRuntimeConfig } from './create-agent-runtime-config.types';

/** Convert public SDK configuration into initialized runtime collaborators. */
export async function prepareAgentRuntimeConfig(
  config: CreateAgentConfig,
): Promise<PreparedAgentRuntimeConfig> {
  const platform: IPlatform = config.platform ?? new BrowserPlatform();
  const { models, model } = createPiModelsForProvider(
    config.model,
    toProviderOptions(config.provider),
  );
  const toolRegistry = createBaseToolRegistry(config);
  const promptManager = new PromptManager();
  if (config.systemPrompt) promptManager.addInstructions(config.systemPrompt);
  const permissionManager = new PermissionManager({
    mode: config.permission ?? 'default',
  });
  const hookManager = createHookManager(config);
  const memoryManager = await createMemoryManager(config, platform, toolRegistry);
  const skillManager = createSkillManager(config);
  const planningManager = await createPlanningManager(
    config,
    platform,
    toolRegistry,
  );
  registerCustomTools(config, toolRegistry);
  const mcp = await connectAgentMcpServers(config.mcpServers);
  const agentConfig: AgentConfig = {
    models,
    piModel: model,
    model: config.model,
    toolRegistry,
    systemPrompt: config.systemPrompt,
    contextConfig: config.contextConfig,
    maxIterations: config.maxIterations,
    workingDir: config.workingDir,
    capabilities: {
      skillManager,
      memoryManager,
      promptManager,
      permissionManager,
      hookManager,
      mcpClients: mcp.clients,
      mcpServerConfigs: mcp.toolConfigs.size > 0
        ? mcp.toolConfigs
        : undefined,
      planningManager,
      resumeManager: new SessionResumeManager(platform.storage),
    },
  };
  return {
    agentConfig,
    platform,
    toolRegistry,
    mcpClients: mcp.clients,
  };
}

function createBaseToolRegistry(config: CreateAgentConfig): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(webFetchDef, new WebFetchExecutor());
  const search = createWebSearchExecutor(
    config.search ?? (config.searchApiKey
      ? { provider: 'tavily', apiKey: config.searchApiKey }
      : null),
    config.searchEndpoint,
  );
  if (search) registry.register(webSearchDef, search);
  return registry;
}

function createHookManager(config: CreateAgentConfig): HookManager {
  const manager = new HookManager();
  for (const [event, handler] of Object.entries(config.hooks ?? {})) {
    if (handler) {
      manager.register({
        event: event as HookEvent,
        handler: handler as HookHandler,
      });
    }
  }
  return manager;
}

async function createMemoryManager(
  config: CreateAgentConfig,
  platform: IPlatform,
  registry: ToolRegistry,
): Promise<MemoryManager | undefined> {
  if (!config.memory) return undefined;
  const manager = new MemoryManager();
  await manager.init(platform.storage);
  registry.register(memorySaveDef, new MemorySaveExecutor(manager));
  registry.register(memoryRecallDef, new MemoryRecallExecutor(manager));
  return manager;
}

function createSkillManager(
  config: CreateAgentConfig,
): SkillManager | undefined {
  if (!config.skills?.length) return undefined;
  const manager = new SkillManager();
  for (const skill of config.skills) manager.register(skill);
  return manager;
}

async function createPlanningManager(
  config: CreateAgentConfig,
  platform: IPlatform,
  registry: ToolRegistry,
): Promise<PlanningManager | undefined> {
  if (!config.planning) return undefined;
  const manager = new PlanningManager();
  await manager.init(platform.storage);
  registry.register(planCreateDef, new PlanCreateExecutor(manager));
  registry.register(planGetStatusDef, new PlanGetStatusExecutor(manager));
  registry.register(planUpdateStepDef, new PlanUpdateStepExecutor(manager));
  return manager;
}

function registerCustomTools(
  config: CreateAgentConfig,
  registry: ToolRegistry,
): void {
  for (const tool of config.tools ?? []) {
    const { execute, ...definition } = tool;
    registry.register(definition, new FunctionToolExecutor(execute));
  }
}

function toProviderOptions(config: CreateAgentConfig['provider']) {
  return {
    family: config.type === 'anthropic'
      ? 'anthropic' as const
      : 'openai' as const,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    models: config.models,
  };
}
