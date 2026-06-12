import 'reflect-metadata';

import type { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig, AgentCapabilities, McpServerToolConfig } from '@svton/agent-core';
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
  // Computer Use tools
  screenshotDef,
  ScreenshotExecutor,
  mouseClickDef,
  MouseClickExecutor,
  mouseMoveDef,
  MouseMoveExecutor,
  keyboardTypeDef,
  KeyboardTypeExecutor,
  keyboardPressKeyDef,
  KeyboardPressKeyExecutor,
  // Chrome CDP tools
  chromeNavigateDef,
  ChromeNavigateExecutor,
  chromeScreenshotDef,
  ChromeScreenshotExecutor,
  chromeClickDef,
  ChromeClickExecutor,
  chromeTypeDef,
  ChromeTypeExecutor,
  chromeEvaluateDef,
  ChromeEvaluateExecutor,
  chromeGetContentDef,
  ChromeGetContentExecutor,
  // Managers
  SkillManager,
  SkillLoader,
  MemoryManager,
  PromptManager,
  PermissionManager,
  HookManager,
  PlanningManager,
  // MCP
  MCPClient,
  HTTPTransport,
  StdioTransport,
  // Plugin
  PluginManager,
} from '@svton/agent-core';
import type { McpServerConfig } from '@svton/agent-ui';
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

  // Computer Use tools (desktop only — rely on Tauri commands)
  toolRegistry.register(screenshotDef, new ScreenshotExecutor());
  toolRegistry.register(mouseClickDef, new MouseClickExecutor());
  toolRegistry.register(mouseMoveDef, new MouseMoveExecutor());
  toolRegistry.register(keyboardTypeDef, new KeyboardTypeExecutor());
  toolRegistry.register(keyboardPressKeyDef, new KeyboardPressKeyExecutor());

  // Chrome CDP tools (requires Chrome with --remote-debugging-port=9222)
  toolRegistry.register(chromeNavigateDef, new ChromeNavigateExecutor());
  toolRegistry.register(chromeScreenshotDef, new ChromeScreenshotExecutor());
  toolRegistry.register(chromeClickDef, new ChromeClickExecutor());
  toolRegistry.register(chromeTypeDef, new ChromeTypeExecutor());
  toolRegistry.register(chromeEvaluateDef, new ChromeEvaluateExecutor());
  toolRegistry.register(chromeGetContentDef, new ChromeGetContentExecutor());

  // ── Capability managers ──
  const skillManager = new SkillManager();
  const promptManager = new PromptManager();

  // Restore saved permission mode
  const savedPermissionMode = await platform.storage.get<string>('agent:permission_mode');
  const permissionManager = new PermissionManager({ mode: (savedPermissionMode as any) || 'default' });

  const hookManager = new HookManager();

  // Determine working directory early (needed for skills, memory, MCP)
  const savedWorkingDir = await platform.storage.get<string>('agent:workingDir');
  const homeDir = platform.process.getEnv('HOME') || platform.process.getEnv('USERPROFILE') || '/';
  const workingDir = savedWorkingDir || homeDir;

  // Load skills via multi-scope discovery
  const { skills: discoveredSkills } = await SkillLoader.discover(
    platform.storage,
    platform,
    BUILTIN_SKILL_PATHS,
    workingDir,
  );
  for (const skill of discoveredSkills) {
    skillManager.register(skill);
  }

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

  // ── Connect MCP servers ──
  const mcpConfigs = await platform.storage.get<McpServerConfig[]>('agent:mcp_servers');
  const mcpClients: import('@svton/agent-core').MCPClient[] = [];

  if (Array.isArray(mcpConfigs)) {
    for (const cfg of mcpConfigs) {
      if (!cfg.enabled) continue;
      try {
        const client = new MCPClient();
        const transport = cfg.transport === 'stdio'
          ? new StdioTransport(platform.process, cfg.command!, cfg.args ?? [], cfg.env, workingDir)
          : new HTTPTransport({ url: cfg.url! });
        await client.connect(transport);
        mcpClients.push(client);
      } catch (err) {
        console.error(`MCP server "${cfg.name}" connection failed:`, err);
      }
    }
  }

  capabilities.mcpClients = mcpClients;

  // Build per-server tool configs for runtime filtering
  if (Array.isArray(mcpConfigs)) {
    const mcpServerConfigs = new Map<string, McpServerToolConfig>();
    for (const cfg of mcpConfigs) {
      if (cfg.approvalMode || cfg.enabledTools?.length || cfg.disabledTools?.length) {
        mcpServerConfigs.set(cfg.name, {
          approvalMode: cfg.approvalMode,
          enabledTools: cfg.enabledTools,
          disabledTools: cfg.disabledTools,
        });
      }
    }
    if (mcpServerConfigs.size > 0) {
      capabilities.mcpServerConfigs = mcpServerConfigs;
    }
  }

  // ── Initialize PluginManager ──
  const pluginManager = new PluginManager();
  await pluginManager.init(platform.storage);
  capabilities.pluginManager = pluginManager;

  // Load enabled plugin skills + MCP servers
  const enabledPlugins = pluginManager.getEnabledPlugins();
  for (const plugin of enabledPlugins) {
    // Load plugin skills
    if (plugin.manifest.skills?.length && plugin.path) {
      for (const skillPath of plugin.manifest.skills) {
        try {
          const fullPath = platform.fs.join(plugin.path, skillPath);
          const content = await platform.fs.readFile(fullPath);
          const skill = SkillLoader.parseMarkdown(content);
          if (skill) {
            skillManager.register({ ...skill, source: { type: 'local', path: fullPath } });
          }
        } catch (err) {
          console.error(`Plugin "${plugin.name}": failed to load skill ${skillPath}:`, err);
        }
      }
    }

    // Load plugin MCP servers
    if (plugin.manifest.mcpServers?.length) {
      for (const mcp of plugin.manifest.mcpServers) {
        if (mcp.enabled === false) continue;
        try {
          const client = new MCPClient();
          const transport = mcp.transport === 'stdio'
            ? new StdioTransport(platform.process, mcp.command!, mcp.args ?? [], mcp.env, workingDir)
            : new HTTPTransport({ url: mcp.url! });
          await client.connect(transport);
          mcpClients.push(client);
        } catch (err) {
          console.error(`Plugin "${plugin.name}": MCP server "${mcp.name}" failed:`, err);
        }
      }
      capabilities.mcpClients = mcpClients;
    }
  }

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
