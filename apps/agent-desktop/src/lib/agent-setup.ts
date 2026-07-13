import 'reflect-metadata';

import type { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig, AgentCapabilities, McpServerToolConfig, WebSearchConfig } from '@svton/agent-core';
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
  createWebSearchExecutor,
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
  mouseDoubleClickDef,
  MouseDoubleClickExecutor,
  mouseMoveDef,
  MouseMoveExecutor,
  mouseDownDef,
  MouseDownExecutor,
  mouseUpDef,
  MouseUpExecutor,
  mouseDragDef,
  MouseDragExecutor,
  scrollDef,
  ScrollExecutor,
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
  // Git code review tools
  gitDiffDef,
  GitDiffExecutor,
  gitLogRangeDef,
  GitLogRangeExecutor,
  // Image generation tool
  imageGenerateDef,
  ImageGenerateExecutor,
  previewDocumentDef,
  PreviewDocumentExecutor,
  // CSV fan-out tool (registered later, needs subagent manager)
  // Managers
  SkillManager,
  SkillLoader,
  MemoryManager,
  PromptManager,
  PermissionManager,
  HookManager,
  PlanningManager,
  SessionResumeManager,
  AgentDefinitionManager,
  WorktreeManager,
  AutoReviewerManager,
  BUILTIN_RULES,
  AutomationManager,
  TimerScheduler,
  IntegrationManager,
  resolveBuiltinIntegrationManifests,
  ChronicleManager,
  createAutomationDef,
  CreateAutomationExecutor,
  ImageGenRegistry,
  OpenAIImageProvider,
  StabilityProvider,
  GoogleImagenProvider,
  codeReviewSkill,
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
  | { kind: 'ready'; config: AgentConfig; extra?: AgentExtra }
  | { kind: 'no_config' }
  | { kind: 'no_api_key' }
  | { kind: 'error'; message: string };

/** Extra managers exposed for UI consumption (not part of AgentConfig). */
export interface AgentExtra {
  chronicleManager: ChronicleManager;
  automationManager: AutomationManager;
  integrationManager: IntegrationManager;
  worktreeManager: WorktreeManager;
  imageGenRegistry: ImageGenRegistry;
}

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
    contextWindow: 512000,
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
  // web_fetch: the standard WebFetchExecutor routes through platform.http,
  // which on desktop is a curl-backed client (TauriPlatform wires this in its
  // constructor). This bypasses the webview CORS restrictions that broke
  // direct fetch() ("Fetch error: Load failed"). No special executor needed.
  toolRegistry.register(webFetchDef, new WebFetchExecutor());
  // web_search: only register when a search backend is configured.
  // Reads Tavily API key first (recommended), then falls back to a custom
  // SearXNG-style endpoint. Without this guard the LLM sees the tool, calls
  // it, and always hits "Web search is not configured" when no backend is set.
  const searchApiKey = await platform.storage.get<string>('searchApiKey');
  const searchEndpoint = await platform.storage.get<string>('searchEndpoint');
  const searchConfig: WebSearchConfig | null = searchApiKey
    ? { provider: 'tavily', apiKey: searchApiKey }
    : searchEndpoint
      ? { provider: 'custom', endpoint: searchEndpoint }
      : null;
  const searchExecutor = createWebSearchExecutor(searchConfig, null);
  if (searchExecutor) {
    toolRegistry.register(webSearchDef, searchExecutor);
  }

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
  toolRegistry.register(mouseDoubleClickDef, new MouseDoubleClickExecutor());
  toolRegistry.register(mouseMoveDef, new MouseMoveExecutor());
  toolRegistry.register(mouseDownDef, new MouseDownExecutor());
  toolRegistry.register(mouseUpDef, new MouseUpExecutor());
  toolRegistry.register(mouseDragDef, new MouseDragExecutor());
  toolRegistry.register(scrollDef, new ScrollExecutor());
  toolRegistry.register(keyboardTypeDef, new KeyboardTypeExecutor());
  toolRegistry.register(keyboardPressKeyDef, new KeyboardPressKeyExecutor());

  // Chrome CDP tools (requires Chrome with --remote-debugging-port=9222)
  toolRegistry.register(chromeNavigateDef, new ChromeNavigateExecutor());
  toolRegistry.register(chromeScreenshotDef, new ChromeScreenshotExecutor());
  toolRegistry.register(chromeClickDef, new ChromeClickExecutor());
  toolRegistry.register(chromeTypeDef, new ChromeTypeExecutor());
  toolRegistry.register(chromeEvaluateDef, new ChromeEvaluateExecutor());
  toolRegistry.register(chromeGetContentDef, new ChromeGetContentExecutor());

  // Git code review tools
  toolRegistry.register(gitDiffDef, new GitDiffExecutor());
  toolRegistry.register(gitLogRangeDef, new GitLogRangeExecutor());

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

  // ── Session Resume (checkpoint) ──
  const resumeManager = new SessionResumeManager(platform.storage);

  // ── Custom Agent Definitions ──
  const agentDefinitionManager = new AgentDefinitionManager(platform.storage);
  await agentDefinitionManager.loadFromStorage();
  for (const def of agentDefinitionManager.getBuiltinDefaults()) {
    agentDefinitionManager.register(def);
  }
  // Load project-level and user-level agent definitions from .svton/agents/*.md
  const _homeDir = platform.process.getEnv('HOME') || platform.process.getEnv('USERPROFILE') || '';
  await agentDefinitionManager.loadFromDirectories(platform.fs, workingDir, _homeDir);

  // ── Git Worktrees ──
  const worktreeManager = new WorktreeManager(platform);

  // ── Auto-reviewer ──
  const autoReviewer = new AutoReviewerManager({
    mode: 'manual',  // Start in manual mode, user can switch
    rules: BUILTIN_RULES,
  });

  // ── Image Generation ──
  const imageGenRegistry = new ImageGenRegistry();
  // Register providers if API keys are available
  const openaiKey = providers.openai?.api_key;
  if (openaiKey) {
    imageGenRegistry.register(new OpenAIImageProvider(), openaiKey);
  }
  // Stability AI (search common config key names)
  const stabilityKey = providers['stability']?.api_key || providers['stabilityai']?.api_key;
  if (stabilityKey) {
    imageGenRegistry.register(new StabilityProvider(), stabilityKey);
  }
  // Google Imagen
  const googleKey = providers['google']?.api_key || providers['googleai']?.api_key || providers['vertex']?.api_key;
  if (googleKey) {
    imageGenRegistry.register(new GoogleImagenProvider('svton-agent'), googleKey);
  }

  // Register image generation tool
  toolRegistry.register(imageGenerateDef, new ImageGenerateExecutor(imageGenRegistry));

  // Document preview tool (desktop — uses platform.preview for PDF/Excel/PPTX)
  toolRegistry.register(previewDocumentDef, new PreviewDocumentExecutor());

  // ── Integrations (Slack / Linear) ──
  const integrationManager = new IntegrationManager(platform.storage);
  for (const manifest of resolveBuiltinIntegrationManifests()) {
    integrationManager.registerManifest(manifest);
  }
  await integrationManager.init();
  // Register tools from enabled integrations
  for (const { definition, executor } of integrationManager.resolveAllTools()) {
    toolRegistry.register(definition, executor);
  }

  // ── Chronicle (screen memory) ──
  const chronicleManager = new ChronicleManager(platform.storage, platform);
  await chronicleManager.init();

  // ── Automations ──
  const automationManager = new AutomationManager(platform.storage, new TimerScheduler());
  await automationManager.init();
  // React shell binds the trigger handler after chat send() is available.

  // Register create_automation tool — lets the LLM create scheduled tasks
  toolRegistry.register(createAutomationDef, new CreateAutomationExecutor(automationManager));

  // Register code review skill
  skillManager.register(codeReviewSkill);

  const capabilities: AgentCapabilities = {
    skillManager,
    memoryManager,
    promptManager,
    permissionManager,
    hookManager,
    planningManager,
    resumeManager,
    agentDefinitionManager,
    worktreeManager,
    autoReviewer,
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
      contextConfig: {
        maxTokens: 512000,
        compactionThreshold: 0.8,
        preserveRecentMessages: 6,
      },
    },
    extra: {
      chronicleManager,
      automationManager,
      integrationManager,
      worktreeManager,
      imageGenRegistry,
    },
  };
}

// ── Skill loading ──────────────────────────────────────────

/** Built-in skill paths served from public/skills/ */
const BUILTIN_SKILL_PATHS = [
  '/skills/engineering-craft-principles/SKILL.md',
  '/skills/universal-craft-principles/SKILL.md',
  '/skills/verify-before-done/SKILL.md',
  '/skills/plan-before-code/SKILL.md',
  '/skills/codegraph-cli-navigation/SKILL.md',
];
