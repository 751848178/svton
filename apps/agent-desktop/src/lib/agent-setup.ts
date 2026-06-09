import 'reflect-metadata';

import type { TauriPlatform } from '@svton/agent-platform';
import type { IStorage } from '@svton/agent-platform';
import type { AgentConfig, AgentCapabilities } from '@svton/agent-core';
import {
  ToolRegistry,
  OpenAIProvider,
  AnthropicProvider,
  // File tools
  fileReadDef,
  FileReadExecutor,
  fileWriteDef,
  FileWriteExecutor,
  fileEditDef,
  FileEditExecutor,
  // Search tools
  grepDef,
  GrepExecutor,
  globDef,
  GlobExecutor,
  // Shell tool
  bashDef,
  BashExecutor,
  // Web tools
  webFetchDef,
  WebFetchExecutor,
  webSearchDef,
  WebSearchExecutor,
  // Memory tools
  memorySaveDef,
  MemorySaveExecutor,
  memoryRecallDef,
  MemoryRecallExecutor,
  // Planning tools
  planCreateDef,
  PlanCreateExecutor,
  planGetStatusDef,
  PlanGetStatusExecutor,
  planUpdateStepDef,
  PlanUpdateStepExecutor,
  // Managers
  SkillManager,
  SkillLoader,
  MemoryManager,
  PromptManager,
  PermissionManager,
  HookManager,
  PlanningManager,
} from '@svton/agent-core';
import { loadConfig, type LoadConfigResult } from './config-store';

export type InitResult =
  | { kind: 'ready'; config: AgentConfig }
  | { kind: 'no_config' }
  | { kind: 'no_api_key' }
  | { kind: 'error'; message: string };

/**
 * Initialize the desktop agent with ALL tools registered.
 * Reads configuration from ~/.svton/config.toml.
 * @param platform TauriPlatform instance
 * @param modelOverride Optional model ID to override the config's default model.
 *                      Will find the provider that has this model and switch to it.
 */
export async function initAgent(platform: TauriPlatform, modelOverride?: string): Promise<InitResult> {
  let result: LoadConfigResult;
  try {
    result = await loadConfig(platform);
  } catch (err: any) {
    return { kind: 'error', message: `Failed to read config: ${err.message || err}` };
  }

  if (result.error) {
    return { kind: 'error', message: result.error };
  }

  if (!result.config) {
    return { kind: 'no_config' };
  }

  const { model: modelConfig, providers } = result.config;

  // Determine which provider to use — support model override for runtime switching
  let providerKey = modelConfig.provider;

  if (modelOverride) {
    // Find the provider that has the requested model
    for (const [key, pCfg] of Object.entries(providers)) {
      if (pCfg.models && modelOverride in pCfg.models) {
        providerKey = key;
        break;
      }
    }
  }

  const providerCfg = providers[providerKey];
  if (!providerCfg) {
    return { kind: 'error', message: `Provider "${providerKey}" not found in config` };
  }

  if (!providerCfg.api_key?.trim()) {
    return { kind: 'no_api_key' };
  }

  // Build model infos
  const modelEntries = Object.entries(providerCfg.models || {});
  const modelInfos = modelEntries.map(([id, name]) => ({
    id,
    name,
    contextWindow: 128000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
  }));

  // Create provider
  const provider = providerCfg.type === 'anthropic'
    ? new AnthropicProvider({
        baseUrl: providerCfg.base_url,
        apiKey: providerCfg.api_key,
        models: modelInfos,
      })
    : new OpenAIProvider({
        name: providerKey,
        baseUrl: providerCfg.base_url,
        apiKey: providerCfg.api_key,
        models: modelInfos,
      });

  const selectedModel = modelOverride || modelConfig.name || modelEntries[0]?.[0] || 'gpt-4o';

  // ── Register ALL tools ──
  const toolRegistry = new ToolRegistry();

  // File tools
  toolRegistry.register(fileReadDef, new FileReadExecutor());
  toolRegistry.register(fileWriteDef, new FileWriteExecutor());
  toolRegistry.register(fileEditDef, new FileEditExecutor());

  // Search tools
  toolRegistry.register(grepDef, new GrepExecutor());
  toolRegistry.register(globDef, new GlobExecutor());

  // Shell tool
  toolRegistry.register(bashDef, new BashExecutor());

  // Web tools
  toolRegistry.register(webFetchDef, new WebFetchExecutor());
  toolRegistry.register(webSearchDef, new WebSearchExecutor());

  // Memory tools
  const memoryManager = new MemoryManager();
  await memoryManager.init(platform.storage);
  toolRegistry.register(memorySaveDef, new MemorySaveExecutor(memoryManager));
  toolRegistry.register(memoryRecallDef, new MemoryRecallExecutor(memoryManager));

  // Planning tools
  const planningManager = new PlanningManager();
  await planningManager.init(platform.storage);
  toolRegistry.register(planCreateDef, new PlanCreateExecutor(planningManager));
  toolRegistry.register(planGetStatusDef, new PlanGetStatusExecutor(planningManager));
  toolRegistry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planningManager));

  // ── Capability managers ──
  const skillManager = new SkillManager();
  const promptManager = new PromptManager();
  const permissionManager = new PermissionManager({ mode: 'default' });
  const hookManager = new HookManager();

  // Load skills: from storage (user-created) + built-in (fetched from public/)
  await loadDesktopSkills(skillManager, platform.storage);

  // Apply disabled tools/skills filtering
  const disabledTools = await platform.storage.get<string[]>('agent:disabled_tools');
  if (Array.isArray(disabledTools)) {
    for (const name of disabledTools) toolRegistry.unregister(name);
  }
  const disabledSkills = await platform.storage.get<string[]>('agent:disabled_skills');
  if (Array.isArray(disabledSkills)) {
    for (const name of disabledSkills) skillManager.unregister(name);
  }

  // Load project memory from AGENT.md files if available
  const workingDir = platform.process.getCwd();
  try {
    await memoryManager.loadProjectMemory(platform.fs, workingDir);
  } catch {
    // No AGENT.md found — that's fine
  }

  const capabilities: AgentCapabilities = {
    skillManager,
    memoryManager,
    promptManager,
    permissionManager,
    hookManager,
    planningManager,
  };

  return {
    kind: 'ready',
    config: {
      provider,
      model: selectedModel,
      toolRegistry,
      workingDir,
      capabilities,
    },
  };
}

// ── Skill loading ──────────────────────────────────────────

/** Built-in skill paths served from public/skills/ */
const BUILTIN_SKILL_PATHS = [
  '/skills/svton/SKILL.md',
  '/skills/svton-api-client/SKILL.md',
  '/skills/svton-service/SKILL.md',
  '/skills/engineering-craft-principles/SKILL.md',
  '/skills/universal-craft-principles/SKILL.md',
];

/**
 * Load skills for desktop:
 * 1. Custom skills from IStorage (user-created)
 * 2. Built-in skills from public/ directory (fetched via HTTP)
 */
async function loadDesktopSkills(skillManager: SkillManager, storage: IStorage): Promise<void> {
  // 1. Load user-created skills from storage
  try {
    const stored = await SkillLoader.fromStorage(storage);
    for (const skill of stored) {
      skillManager.register(skill);
    }
  } catch {
    // Storage read failed — skip
  }

  // 2. Load built-in skills from bundled assets
  for (const url of BUILTIN_SKILL_PATHS) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const content = await resp.text();
        const skill = SkillLoader.parseMarkdown(content);
        // Don't overwrite storage skills with same name
        if (!skillManager.list().find((s) => s.name === skill.name)) {
          skillManager.register(skill);
        }
      }
    } catch {
      // Skip skills that fail to load
    }
  }
}
