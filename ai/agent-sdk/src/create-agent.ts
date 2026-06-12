/**
 * createAgent — one-call entry point for the AI Agent SDK.
 *
 * Hides all internal wiring (provider, toolRegistry, managers, MCP, runtime)
 * behind a single async function.
 */

import {
  AgentRuntime,
  OpenAIProvider,
  AnthropicProvider,
  ToolRegistry,
  PromptManager,
  PermissionManager,
  HookManager,
  MemoryManager,
  SkillManager,
  PlanningManager,
  SubagentManager,
  MCPClient,
  HTTPTransport,
  SSETransport,
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
} from '@svton/agent-core';
import type {
  AgentConfig,
  McpServerToolConfig,
} from '@svton/agent-core';
import { BrowserPlatform } from '@svton/agent-platform';
import type { IPlatform } from '@svton/agent-platform';

import type { CreateAgentConfig } from './types';
import { Agent } from './agent';
import { FunctionToolExecutor } from './tool-adapter';

/**
 * Create a fully-configured AI Agent with a single call.
 *
 * ```ts
 * const agent = await createAgent({
 *   provider: { type: 'openai', apiKey: 'sk-xxx', model: 'gpt-4o' },
 *   systemPrompt: 'You are a helpful assistant.',
 *   tools: [myCustomTool],
 *   memory: true,
 * });
 *
 * for await (const event of agent.chat('Hello!')) {
 *   if (event.type === 'text_delta') process.stdout.write(event.text);
 * }
 * ```
 */
export async function createAgent(config: CreateAgentConfig): Promise<Agent> {
  // ----------------------------------------------------------
  // 1. Platform
  // ----------------------------------------------------------
  const platform: IPlatform = config.platform ?? new BrowserPlatform();

  // ----------------------------------------------------------
  // 2. Provider
  // ----------------------------------------------------------
  const provider = createProvider(config.provider);

  // ----------------------------------------------------------
  // 3. Tool Registry + built-in web tools
  // ----------------------------------------------------------
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(webFetchDef, new WebFetchExecutor());

  // web_search — executor returns an error message if no endpoint is configured
  toolRegistry.register(webSearchDef, new WebSearchExecutor());

  // ----------------------------------------------------------
  // 4. Capability managers
  // ----------------------------------------------------------

  // Prompt
  const promptManager = new PromptManager();
  if (config.systemPrompt) {
    promptManager.addInstructions(config.systemPrompt);
  }

  // Permission
  const permissionManager = new PermissionManager({
    mode: config.permission ?? 'default',
  });

  // Hooks
  const hookManager = new HookManager();
  if (config.hooks) {
    for (const [event, handler] of Object.entries(config.hooks)) {
      if (handler !== undefined && handler !== null) {
        hookManager.register({
          event: event as import('@svton/agent-core').HookEvent,
          handler: handler as import('@svton/agent-core').HookHandler,
        });
      }
    }
  }

  // Memory (optional)
  let memoryManager: MemoryManager | undefined;
  if (config.memory) {
    memoryManager = new MemoryManager();
    await memoryManager.init(platform.storage);
    toolRegistry.register(memorySaveDef, new MemorySaveExecutor(memoryManager));
    toolRegistry.register(memoryRecallDef, new MemoryRecallExecutor(memoryManager));
  }

  // Skills (optional)
  let skillManager: SkillManager | undefined;
  if (config.skills && config.skills.length > 0) {
    skillManager = new SkillManager();
    for (const skill of config.skills) {
      skillManager.register(skill);
    }
  }

  // Planning (optional)
  let planningManager: PlanningManager | undefined;
  if (config.planning) {
    planningManager = new PlanningManager();
    await planningManager.init(platform.storage);
    toolRegistry.register(planCreateDef, new PlanCreateExecutor(planningManager));
    toolRegistry.register(planGetStatusDef, new PlanGetStatusExecutor(planningManager));
    toolRegistry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planningManager));
  }

  // ----------------------------------------------------------
  // 5. User-defined custom tools
  // ----------------------------------------------------------
  if (config.tools) {
    for (const tool of config.tools) {
      toolRegistry.register(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          annotations: tool.annotations,
        },
        new FunctionToolExecutor(tool.execute),
      );
    }
  }

  // ----------------------------------------------------------
  // 6. MCP servers
  // ----------------------------------------------------------
  const mcpClients: MCPClient[] = [];
  const mcpServerConfigs = new Map<string, McpServerToolConfig>();

  if (config.mcpServers) {
    for (const serverConfig of config.mcpServers) {
      const client = new MCPClient();
      const serverName = serverConfig.name || `mcp-${mcpClients.length + 1}`;

      try {
        const transport =
          serverConfig.type === 'sse'
            ? new SSETransport({ url: serverConfig.url, headers: serverConfig.headers })
            : new HTTPTransport({ url: serverConfig.url, headers: serverConfig.headers });

        await client.connect(transport);
        mcpClients.push(client);

        if (serverConfig.toolFilter) {
          mcpServerConfigs.set(serverName, {
            approvalMode: serverConfig.toolFilter.approvalMode,
            enabledTools: serverConfig.toolFilter.enabled,
            disabledTools: serverConfig.toolFilter.disabled,
          });
        }
      } catch (err) {
        console.warn(
          `[agent-sdk] Failed to connect MCP server "${serverName}" at ${serverConfig.url}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  // ----------------------------------------------------------
  // 7. Assemble AgentConfig and create runtime
  // ----------------------------------------------------------
  const agentConfig: AgentConfig = {
    provider,
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
      mcpClients,
      mcpServerConfigs: mcpServerConfigs.size > 0 ? mcpServerConfigs : undefined,
      planningManager,
    },
  };

  const runtime = await AgentRuntime.createAsync(agentConfig, platform);

  // ----------------------------------------------------------
  // 8. Wire SubagentManager (post-creation, breaks circular dep)
  // ----------------------------------------------------------
  const subagentManager = new SubagentManager(
    agentConfig,
    runtime,
    platform,
    toolRegistry,
  );
  runtime.setSubagentManager(subagentManager);

  // ----------------------------------------------------------
  // 9. Return Agent wrapper
  // ----------------------------------------------------------
  return new Agent(runtime, toolRegistry, platform, mcpClients);
}

// ============================================================
// Internal helpers
// ============================================================

function createProvider(config: CreateAgentConfig['provider']) {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider({
        name: 'openai',
        baseUrl: config.baseUrl || 'https://api.openai.com',
        apiKey: config.apiKey,
        models: config.models ?? [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            contextWindow: 128000,
            supportsToolUse: true,
            supportsVision: true,
            supportsStreaming: true,
          },
        ],
        customHeaders: config.customHeaders,
      });

    case 'anthropic':
      return new AnthropicProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        models: config.models,
        customHeaders: config.customHeaders,
      });

    default:
      throw new Error(
        `[agent-sdk] Unknown provider type: "${(config as { type: string }).type}". Use 'openai' or 'anthropic'.`,
      );
  }
}
