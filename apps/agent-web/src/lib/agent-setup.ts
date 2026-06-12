import 'reflect-metadata';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { AgentConfig, AgentCapabilities, McpServerToolConfig } from '@svton/agent-core';
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
  SkillManager,
  SkillLoader,
  MemoryManager,
  PromptManager,
  PermissionManager,
  HookManager,
  PlanningManager,
  MCPClient,
  HTTPTransport,
  PluginManager,
} from '@svton/agent-core';
import type { McpServerConfig } from '@svton/agent-ui';
import {
  loadSettings,
  loadString,
  loadJsonList,
  LS_SEARCH_ENDPOINT,
  LS_PERMISSION_MODE,
  LS_DISABLED_TOOLS,
  LS_DISABLED_SKILLS,
  LS_CUSTOM_INSTRUCTIONS,
} from './settings-store';

/** Built-in skills to load from public directory */
const SKILL_PATHS = [
  '/skills/svton/SKILL.md',
  '/skills/svton-api-client/SKILL.md',
  '/skills/svton-service/SKILL.md',
  '/skills/engineering-craft-principles/SKILL.md',
  '/skills/universal-craft-principles/SKILL.md',
];

/**
 * Initialize the platform and return an AgentConfig with all capabilities wired.
 * @param model The model to use
 * @param platform The platform instance (created by the caller)
 */
export async function initAgentConfig(model?: string, platform?: BrowserPlatform): Promise<AgentConfig> {
  if (!platform) throw new Error('Platform instance is required');

  // Load provider settings from storage
  const settings = loadSettings();

  // Find the provider that has the selected model
  let providerSetting = settings.find((p) =>
    p.models.some((m) => m.id === model),
  );
  if (!providerSetting) {
    providerSetting = settings.find((p) => p.apiKey);
  }
  if (!providerSetting) {
    providerSetting = settings[0];
  }
  if (!providerSetting) {
    throw new Error('No provider configured. Please add an API key in settings.');
  }

  const selectedModel = model || providerSetting.models[0]?.id || 'gpt-4o';

  // Create provider based on type
  const modelInfos = providerSetting.models.map((m) => ({
    id: m.id,
    name: m.name,
    contextWindow: 128000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
  }));

  const provider = providerSetting.type === 'anthropic'
    ? new AnthropicProvider({
        baseUrl: providerSetting.baseUrl,
        apiKey: providerSetting.apiKey,
        models: modelInfos,
      })
    : new OpenAIProvider({
        name: providerSetting.name,
        baseUrl: providerSetting.baseUrl,
        apiKey: providerSetting.apiKey,
        models: modelInfos,
      });

  // Register tools (browser: limited set, no filesystem/shell)
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(webFetchDef, new WebFetchExecutor());

  // Register web_search if endpoint is configured
  const searchEndpoint = loadString(LS_SEARCH_ENDPOINT);
  if (searchEndpoint) {
    toolRegistry.register(webSearchDef, new WebSearchExecutor(searchEndpoint));
  }

  // ── Wire all capability managers ──

  // MemoryManager — must init first because memory tools reference it
  const memoryManager = new MemoryManager();
  await memoryManager.init(platform.storage);

  // Register memory tools
  toolRegistry.register(memorySaveDef, new MemorySaveExecutor(memoryManager));
  toolRegistry.register(memoryRecallDef, new MemoryRecallExecutor(memoryManager));

  // SkillManager — multi-scope discovery (web: no filesystem, no project scope)
  const skillManager = new SkillManager();
  const { skills: discoveredSkills } = await SkillLoader.discover(
    platform.storage,
    platform,
    SKILL_PATHS,
  );
  for (const skill of discoveredSkills) {
    skillManager.register(skill);
  }

  // PromptManager — will compose system prompt with tools + skills + memory
  const promptManager = new PromptManager();

  // PermissionManager — restore saved mode
  const savedMode = loadString(LS_PERMISSION_MODE);
  const permissionManager = new PermissionManager({ mode: (savedMode as any) || 'default' });

  // HookManager — empty, can be extended later
  const hookManager = new HookManager();

  // PlanningManager — persist in storage
  const planningManager = new PlanningManager();
  await planningManager.init(platform.storage);

  // Register planning tools
  toolRegistry.register(planCreateDef, new PlanCreateExecutor(planningManager));
  toolRegistry.register(planGetStatusDef, new PlanGetStatusExecutor(planningManager));
  toolRegistry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planningManager));

  // Filter out disabled tools
  const disabledTools = loadJsonList(LS_DISABLED_TOOLS);
  if (disabledTools.length > 0) {
    for (const name of disabledTools) {
      toolRegistry.unregister(name);
    }
  }

  // Filter out disabled skills
  const disabledSkills = loadJsonList(LS_DISABLED_SKILLS);
  if (disabledSkills.length > 0) {
    for (const name of disabledSkills) {
      skillManager.unregister(name);
    }
  }

  const capabilities: AgentCapabilities = {
    skillManager,
    memoryManager,
    promptManager,
    permissionManager,
    hookManager,
    planningManager,
    // subagentManager: set post-creation via setSubagentManager()
  };

  // ── Connect MCP servers (HTTP only for browser) ──
  const LS_MCP_SERVERS = 'agent-web:mcp_servers';
  let mcpConfigs: McpServerConfig[] = [];
  try {
    mcpConfigs = JSON.parse(localStorage.getItem(LS_MCP_SERVERS) || '[]');
  } catch { /* ignore */ }

  const mcpClients: import('@svton/agent-core').MCPClient[] = [];
  for (const cfg of mcpConfigs) {
    if (!cfg.enabled || cfg.transport === 'stdio') continue;
    try {
      const client = new MCPClient();
      const transport = new HTTPTransport({ url: cfg.url! });
      await client.connect(transport);
      mcpClients.push(client);
    } catch (err) {
      console.error(`MCP server "${cfg.name}" connection failed:`, err);
    }
  }
  if (mcpClients.length > 0) {
    capabilities.mcpClients = mcpClients;
  }

  // Build per-server tool configs for runtime filtering
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

  // ── Initialize PluginManager ──
  const pluginManager = new PluginManager();
  await pluginManager.init(platform.storage);
  capabilities.pluginManager = pluginManager;

  // Load enabled plugin MCP servers (HTTP only for web)
  const enabledPlugins = pluginManager.getEnabledPlugins();
  for (const plugin of enabledPlugins) {
    if (plugin.manifest.mcpServers?.length) {
      for (const mcp of plugin.manifest.mcpServers) {
        if (mcp.enabled === false || mcp.transport === 'stdio') continue;
        try {
          const client = new MCPClient();
          const transport = new HTTPTransport({ url: mcp.url! });
          await client.connect(transport);
          mcpClients.push(client);
        } catch (err) {
          console.error(`Plugin "${plugin.name}": MCP server "${mcp.name}" failed:`, err);
        }
      }
      capabilities.mcpClients = mcpClients;
    }
  }

  // Custom instructions → append to system prompt
  const customInstructions = loadString(LS_CUSTOM_INSTRUCTIONS);

  return {
    provider,
    model: selectedModel,
    toolRegistry,
    workingDir: '/',
    capabilities,
    ...(customInstructions ? { systemPrompt: `\n\n### Custom Instructions\n${customInstructions}` } : {}),
  };
}
