import {
  AgentDefinitionManager,
  HookManager,
  IntegrationManager,
  PermissionManager,
  PromptManager,
  SessionResumeManager,
  SkillLoader,
  SkillManager,
  codeReviewSkill,
  type AgentCapabilities,
  type SkillDefinition,
  type ToolRegistry,
  type MemoryManager,
  type PlanningManager,
} from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type {
  FeatureFlags,
  IntegrationConfig,
  McpServerEntry,
} from '../types';
import { BUILTIN_SKILLS } from './builtin-skills';
import { connectAgentMcpCapabilities } from './agent-config-mcp.service';
import {
  AGENT_CONFIG_STORAGE_KEYS,
  loadPermissionMode,
  loadStoredStringList,
} from './agent-config-storage.utils';
import { resolveAgentAppIntegrationManifests } from './integrations';
import type { AgentAppStorage } from './storage';

interface CreateAgentCapabilitiesOptions {
  platform: BrowserPlatform;
  features: FeatureFlags;
  toolRegistry: ToolRegistry;
  memoryManager?: MemoryManager;
  planningManager?: PlanningManager;
  storage: AgentAppStorage;
  workingDir: string;
  systemPrompt?: string;
  skills: SkillDefinition[];
  skillPaths: string[];
  registerBuiltinSkills: boolean;
  mcpServers: McpServerEntry[];
  integrations?: IntegrationConfig;
}

export async function createAgentCapabilities(
  options: CreateAgentCapabilitiesOptions,
): Promise<AgentCapabilities> {
  const {
    platform,
    features,
    toolRegistry,
    memoryManager,
    planningManager,
    storage,
    workingDir,
    systemPrompt,
    skills,
    skillPaths,
    registerBuiltinSkills,
    mcpServers,
    integrations,
  } = options;
  const skillManager = new SkillManager();

  if (registerBuiltinSkills) {
    for (const skill of BUILTIN_SKILLS) skillManager.register(skill);
  }
  const discovered = await SkillLoader.discover(
    platform.storage,
    platform,
    skillPaths,
    workingDir,
  );
  for (const skill of discovered.skills) skillManager.register(skill);
  if (features.codeReview !== false) skillManager.register(codeReviewSkill);
  for (const skill of skills) skillManager.register(skill);

  for (const name of loadStoredStringList(
    storage,
    AGENT_CONFIG_STORAGE_KEYS.disabledTools,
  )) {
    if (name === 'request_user_input') continue;
    toolRegistry.unregister(name);
  }
  for (const name of loadStoredStringList(
    storage,
    AGENT_CONFIG_STORAGE_KEYS.disabledSkills,
  )) {
    skillManager.unregister(name);
  }

  const promptManager = new PromptManager();
  if (systemPrompt) promptManager.addInstructions(systemPrompt);
  const resumeManager = features.sessionResume === false
    ? undefined
    : new SessionResumeManager(platform.storage);
  const agentDefinitionManager = features.agentDefinitions === false
    ? undefined
    : new AgentDefinitionManager(platform.storage);
  if (agentDefinitionManager) {
    await agentDefinitionManager.loadFromStorage();
    for (const definition of agentDefinitionManager.getBuiltinDefaults()) {
      agentDefinitionManager.register(definition);
    }
  }

  const integrationManifests = features.integrations === false
    ? []
    : resolveAgentAppIntegrationManifests(integrations);
  if (integrationManifests.length > 0) {
    const integrationManager = new IntegrationManager(platform.storage);
    for (const manifest of integrationManifests) {
      integrationManager.registerManifest(manifest);
    }
    await integrationManager.init();
    for (const tool of integrationManager.resolveAllTools()) {
      toolRegistry.register(tool.definition, tool.executor);
    }
  }

  const capabilities: AgentCapabilities & { csvFanoutEnabled?: boolean } = {
    skillManager,
    memoryManager,
    promptManager,
    permissionManager: new PermissionManager({
      mode: loadPermissionMode(storage),
    }),
    hookManager: new HookManager(),
    planningManager,
    resumeManager,
    agentDefinitionManager,
    csvFanoutEnabled: features.csvFanout !== false,
  };
  await connectAgentMcpCapabilities({
    platform,
    features,
    servers: mcpServers,
    capabilities,
  });
  return capabilities;
}
