import type { IProvider, ChatMessage, ChatOptions, StreamEvent, ReasoningEffort } from '../provider/types';
import type { ToolCall, ToolResult, ToolContext } from '../tool/types';
import type { ToolRegistry } from '../tool/registry';
import type { AgentEvent, AgentConfig, AgentCapabilities, RunOptions, PendingApproval, IRuntime, McpServerToolConfig } from './types';
import type { IPlatform } from '@svton/agent-platform';
import type { PermissionManager } from '../permission/manager';
import type { HookManager } from '../hooks/manager';
import type { SkillManager } from '../skill/manager';
import type { SkillDefinition } from '../skill/types';
import type { MemoryManager } from '../memory/manager';
import type { PromptManager } from '../prompt/manager';
import type { MCPClient } from '../mcp/client';
import type { SubagentManager } from '../subagent/manager';
import type { PlanningManager } from '../planning/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import { ContextManager } from './context';
import { ToolExecutionService } from './tool-executor';
import { createToolExecOptions } from './tool-exec-options.utils';
import { logger } from '../utils/logger';

const DEFAULT_MAX_ITERATIONS = 50;

/**
 * AgentRuntime - the core ReAct loop.
 *
 * Think → Act (tool call) → Observe → Think → ...
 *
 * Integrates all capability managers:
 * - PromptManager: composes system prompt with tools/skills/memory
 * - SkillManager: discovers and injects relevant skill instructions
 * - MemoryManager: provides context notes for system prompt
 * - PermissionManager: checks tool calls against permission rules
 * - HookManager: fires pre/post tool use hooks
 * - MCPClient: bridges external MCP tools into the registry
 * - SubagentManager: spawns isolated sub-agents (set post-creation)
 * - PlanningManager: tracks multi-step task execution
 * - ContextManager: handles message history and compaction
 */
export class AgentRuntime implements IRuntime {
  private readonly provider: IProvider;
  private readonly model: string;
  private readonly toolRegistry: ToolRegistry;
  private systemPrompt: string;
  private readonly contextManager: ContextManager;
  private readonly maxIterations: number;
  private readonly workingDir: string;

  // Capabilities (all nullable for backward compat)
  private readonly skillManager: SkillManager | null;
  private readonly memoryManager: MemoryManager | null;
  private readonly promptManager: PromptManager | null;
  private readonly permissionManager: PermissionManager | null;
  private readonly hookManager: HookManager | null;
  private readonly mcpClients: MCPClient[];
  private readonly mcpServerConfigs: Map<string, McpServerToolConfig>;
  private subagentManager: SubagentManager | null;
  private readonly planningManager: PlanningManager | null;
  private readonly resumeManager: SessionResumeManager | null;
  private readonly autoReviewer: import('../auto-reviewer/manager').AutoReviewerManager | null;
  private readonly agentDefinitionManager: import('../agent-definition/manager').AgentDefinitionManager | null;

  private aborted = false;
  private pendingApprovals = new Map<string, PendingApproval>();
  private currentController: AbortController | null = null;
  private toolExecService: ToolExecutionService;
  private reasoningEffort: ReasoningEffort | undefined;
  /** Skills currently active in this run (set by injectSkillContext, read by tool execution) */
  private activeSkills: SkillDefinition[] = [];

  private constructor(
    config: AgentConfig,
    private readonly platform: IPlatform,
  ) {
    this.provider = config.provider;
    this.model = config.model;
    this.toolRegistry = config.toolRegistry;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.workingDir = config.workingDir || '/';
    this.contextManager = new ContextManager(config.contextConfig);

    // Pull managers from capabilities
    const caps = config.capabilities;
    this.skillManager = caps?.skillManager ?? null;
    this.memoryManager = caps?.memoryManager ?? null;
    this.promptManager = caps?.promptManager ?? null;
    this.permissionManager = caps?.permissionManager ?? null;
    this.hookManager = caps?.hookManager ?? null;
    this.mcpClients = caps?.mcpClients ?? [];
    this.mcpServerConfigs = caps?.mcpServerConfigs ?? new Map();
    this.subagentManager = caps?.subagentManager ?? null;
    this.planningManager = caps?.planningManager ?? null;
    this.resumeManager = caps?.resumeManager ?? null;
    this.autoReviewer = caps?.autoReviewer ?? null;
    this.agentDefinitionManager = caps?.agentDefinitionManager ?? null;

    // Build the system prompt using PromptManager if available
    this.systemPrompt = config.systemPrompt || this.composeSystemPrompt();

    // Wire provider to context manager for LLM-based summarization
    this.contextManager.setProvider(this.provider, this.model);

    // Initialize tool execution service
    this.toolExecService = new ToolExecutionService(
      this.toolRegistry,
      this.contextManager,
      this.platform,
      this.workingDir,
      this.permissionManager,
      this.hookManager,
      this.pendingApprovals,
    );

    this.configureToolExecutionService();
  }

  /**
   * Synchronous factory — does NOT bridge MCP tools.
   * Use createAsync() when MCP clients are present.
   */
  static create(config: AgentConfig, platform: IPlatform): AgentRuntime {
    return new AgentRuntime(config, platform);
  }

  /**
   * Async factory — bridges MCP tools into the registry,
   * then re-composes the system prompt with the full tool set.
   */
  static async createAsync(config: AgentConfig, platform: IPlatform): Promise<AgentRuntime> {
    const runtime = new AgentRuntime(config, platform);
    await runtime.initialize();
    return runtime;
  }

  /**
   * Set the permission manager (backward compatible setter).
   * Also updates the ToolExecutionService reference.
   */
  setPermissionManager(manager: PermissionManager): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).permissionManager = manager;
    // Re-create tool exec service with the updated manager
    this.toolExecService = new ToolExecutionService(
      this.toolRegistry,
      this.contextManager,
      this.platform,
      this.workingDir,
      manager,
      this.hookManager,
      this.pendingApprovals,
    );
    this.configureToolExecutionService();
  }

  /**
   * Set the hook manager (backward compatible setter).
   * Also updates the ToolExecutionService reference.
   */
  setHookManager(manager: HookManager): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).hookManager = manager;
    // Re-create tool exec service with the updated manager
    this.toolExecService = new ToolExecutionService(
      this.toolRegistry,
      this.contextManager,
      this.platform,
      this.workingDir,
      this.permissionManager,
      manager,
      this.pendingApprovals,
    );
    this.configureToolExecutionService();
  }

  private configureToolExecutionService(): void {
    this.toolExecService.setExecOptions(createToolExecOptions({ platform: this.platform, workingDir: this.workingDir, autoReviewer: this.autoReviewer, resumeManager: this.resumeManager }));
  }

  /**
   * Set the subagent manager (must be set post-creation due to circular dependency).
   */
  setSubagentManager(manager: SubagentManager): void {
    this.subagentManager = manager;
  }

  /**
   * Set the reasoning effort level for subsequent runs.
   * Maps to provider-specific reasoning parameters (e.g. Anthropic thinkingBudget, OpenAI reasoning_effort).
   */
  setReasoningEffort(effort: ReasoningEffort | undefined): void {
    this.reasoningEffort = effort;
  }

  /** Get the current reasoning effort level. */
  getReasoningEffort(): ReasoningEffort | undefined {
    return this.reasoningEffort;
  }

  /** Get the resume manager if available. */
  getResumeManager(): SessionResumeManager | null {
    return this.resumeManager;
  }

  /** Get the agent definition manager if available. */
  getAgentDefinitionManager(): import('../agent-definition/manager').AgentDefinitionManager | null {
    return this.agentDefinitionManager;
  }

  /**
   * Switch active agent definition — updates system prompt, permissions, and tool filtering.
   * Called when user types `/agent <name>`.
   */
  switchAgentDefinition(name: string): boolean {
    if (!this.agentDefinitionManager) return false;
    const def = this.agentDefinitionManager.get(name);
    if (!def) return false;

    // Update system prompt if the definition provides one
    if (def.systemPrompt) {
      if (this.promptManager) {
        this.promptManager.clearInstructions();
        this.promptManager.addInstructions(def.systemPrompt);
      }
      this.systemPrompt = this.composeSystemPrompt();
    }

    // Update permission mode if specified
    if (def.permissions && this.permissionManager) {
      this.permissionManager.setMode(def.permissions);
    }

    logger.info('Runtime', `Switched to agent: ${name}`, {
      model: def.model,
      permissions: def.permissions,
    });
    return true;
  }

  /**
   * Run the agent loop with the given user message.
   * Accepts either a plain string or structured content (text + images).
   */
  async *run(userMessage: string | import('../provider/types').ContentBlock[], options?: RunOptions): AsyncGenerator<AgentEvent> {
    this.aborted = false;
    const messageText = typeof userMessage === 'string' ? userMessage : userMessage.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('');
    logger.info('Runtime', 'Run started', { model: this.model, messageLength: messageText.length });

    // Handle /agent <name> command — switch agent definition
    const agentMatch = messageText.match(/^\/agent\s+(\S+)/);
    if (agentMatch && this.agentDefinitionManager) {
      const agentName = agentMatch[1];
      const switched = this.switchAgentDefinition(agentName);
      yield {
        type: 'text_delta',
        text: switched
          ? `Switched to agent: ${agentName}`
          : `Agent "${agentName}" not found. Available: ${this.agentDefinitionManager.list().map(a => a.name).join(', ')}`,
      };
      yield this.doneEvent('stop');
      return;
    }

    // Fire session_start hooks
    if (this.hookManager) {
      const hookResult = await this.hookManager.trigger('session_start', { event: 'session_start' });
      if (hookResult.action === 'deny') {
        yield { type: 'warning', text: `Session blocked by hook: ${hookResult.reason}`, source: 'hook' };
      }
    }

    // Warn if no tools registered
    if (this.toolRegistry.listDefinitions().length === 0) {
      yield { type: 'warning', text: 'No tools registered. The agent will only be able to respond with text.', source: 'runtime' };
    }

    // Add user message to context
    this.contextManager.addMessage({
      role: 'user',
      content: userMessage,
    });

    // Inject relevant skill instructions (text-based matching) and notify the
    // frontend which skills are active so the activity indicator can show them.
    const activeSkillNames = await this.injectSkillContext(messageText);
    if (activeSkillNames.length > 0) {
      yield { type: 'skill_activated', skills: activeSkillNames };
    }

    const maxIterations = options?.maxIterations ?? this.maxIterations;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (this.aborted || options?.signal?.aborted) {
        logger.info('Runtime', 'Run aborted');
        yield this.doneEvent('aborted');
        return;
      }

      // Compaction
      if (this.contextManager.needsCompaction()) {
        const { removed, summary } = await this.contextManager.compact();
        const summaryText = summary
          ? `Compacted ${removed.length} messages. Summary: ${summary.slice(0, 200)}...`
          : `Compacted ${removed.length} messages to free context space.`;
        yield { type: 'context_compacted', summary: summaryText };
        if (this.hookManager) {
          await this.hookManager.trigger('context_compact', { event: 'context_compact', summary: summaryText });
        }
      }

      const messages = this.contextManager.getMessages();
      const tools = this.toolRegistry.listDefinitions();
      this.currentController = new AbortController();

      logger.debug('Runtime', `Iteration ${iteration + 1}/${maxIterations}`, {
        msgCount: messages.length,
        toolCount: tools.length,
      });

      try {
        const chatOptions: ChatOptions = {
          model: this.model,
          tools: tools.length > 0 ? tools : undefined,
          stream: true,
          systemPrompt: this.systemPrompt,
          signal: this.currentController.signal,
          reasoningEffort: this.reasoningEffort,
        };

        let fullText = '';
        let thinkingText = '';
        let stopReason = '';
        const toolCalls: ToolCall[] = [];
        const toolCallBuffers = new Map<string, { name: string; args: string }>();
        let lastUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

        for await (const event of this.provider.chat(messages, chatOptions)) {
          if (this.aborted) break;

          switch (event.type) {
            case 'text_delta':
              fullText += event.text;
              yield { type: 'text_delta', text: event.text };
              break;

            case 'thinking_delta':
              thinkingText += event.thinking;
              yield { type: 'thinking_delta', thinking: event.thinking };
              break;

            case 'tool_call_start':
              toolCallBuffers.set(event.id, { name: event.name, args: '' });
              yield {
                type: 'tool_call_start',
                call: { id: event.id, name: event.name, arguments: {} },
              };
              break;

            case 'tool_call_delta': {
              const buffer = toolCallBuffers.get(event.id);
              if (buffer) buffer.args += event.argumentsDelta;
              break;
            }

            case 'tool_call_end': {
              const buf = toolCallBuffers.get(event.id);
              if (buf) {
                let args: Record<string, unknown> = {};
                try {
                  args = JSON.parse(buf.args || '{}');
                } catch {
                  args = { raw: buf.args };
                }

                const toolCall: ToolCall = {
                  id: event.id,
                  name: buf.name,
                  arguments: args,
                };
                toolCalls.push(toolCall);
                // Don't execute yet — assistant message must be added to
                // context BEFORE tool results to satisfy OpenAI API ordering.
              }
              break;
            }

            case 'usage':
              lastUsage = event.usage;
              break;

            case 'done':
              stopReason = event.stopReason;
              break;
          }
        }

        // Add assistant message to context FIRST (must precede tool results)
        this.contextManager.addMessage(
          this.buildAssistantMessage(fullText, toolCalls, thinkingText || undefined),
        );

        // Emit parsed arguments for UI update (tool_call_start sends empty {})
        for (const tc of toolCalls) {
          yield { type: 'tool_call_progress', callId: tc.id, message: '', arguments: tc.arguments };
        }

        // NOW execute tools and add results to context (correct ordering)
        this.toolExecService.setActiveSkills(this.activeSkills);
        this.toolExecService.setExecOptions({ sessionId: options?.sessionId });
        for (const toolCall of toolCalls) {
          yield* this.toolExecService.execute(toolCall);
        }

        logger.debug('Runtime', 'Stream complete', {
          textLength: fullText.length,
          toolCallCount: toolCalls.length,
          stopReason,
          usage: lastUsage,
        });

        // Terminate only if no tool calls were made.
        // If tool calls exist, always continue the loop so the LLM can process results,
        // regardless of what stopReason the provider returned.
        // (Some providers return 'stop' even when tool calls are present.)
        if (toolCalls.length === 0) {
          logger.info('Runtime', 'Run complete', { stopReason, iterations: iteration + 1 });
          yield { type: 'done', stopReason: stopReason || 'stop', usage: lastUsage };
          // Fire-and-forget checkpoint save with real session ID
          if (this.resumeManager) {
            const sid = options?.sessionId ?? 'default';
            this.resumeManager.checkpoint(sid, this).catch(() => {});
          }
          // Fire-and-forget auto memory extraction
          if (this.memoryManager && this.provider) {
            const messages = this.contextManager.getMessages();
            const convMessages = messages.map(m => ({
              role: m.role,
              content: typeof m.content === 'string'
                ? m.content
                : JSON.stringify(m.content).slice(0, 500),
            }));
            this.memoryManager
              .extractFromConversation(convMessages, this.provider as any, this.model)
              .catch(() => {});
          }
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          yield this.doneEvent('aborted');
          return;
        }
        yield { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
        yield this.doneEvent('error');
        return;
      }
    }

    yield this.doneEvent('max_iterations');
  }

  approveToolCall(callId: string): void {
    const pending = this.pendingApprovals.get(callId);
    if (pending) {
      pending.resolve(true);
      this.pendingApprovals.delete(callId);
    }
  }

  rejectToolCall(callId: string): void {
    const pending = this.pendingApprovals.get(callId);
    if (pending) {
      pending.resolve(false);
      this.pendingApprovals.delete(callId);
    }
  }

  abort(): void {
    this.aborted = true;
    this.currentController?.abort();
    for (const pending of this.pendingApprovals.values()) {
      pending.resolve(false);
    }
    this.pendingApprovals.clear();
  }

  getMessages(): ChatMessage[] {
    return this.contextManager.getMessages();
  }

  /**
   * Restore conversation history into the runtime context.
   * Used when loading a saved session so the LLM has prior context.
   */
  setMessages(messages: ChatMessage[]): void {
    this.contextManager.setMessages(messages);
  }

  // ----------------------------------------------------------
  // Private — Initialization
  // ----------------------------------------------------------

  /**
   * Async initialization: bridge MCP tools, re-compose system prompt.
   */
  private async initialize(): Promise<void> {
    // Bridge MCP tools into the registry
    for (const client of this.mcpClients) {
      if (!client.connected) continue;
      try {
        const serverName = client.info?.name ?? '';
        const serverConfig = serverName ? this.mcpServerConfigs.get(serverName) : undefined;
        const mcpTools = await client.listTools();
        const toolDefs = client.toToolDefinitions(mcpTools);

        for (const def of toolDefs) {
          // Codex-standard namespacing: mcp__<server>__<tool>
          // The MCP client already returns names as <server>__<tool>; add the
          // mcp__ prefix so MCP tools are structurally distinguishable from
          // built-in tools (matching the convention used by Codex).
          const namespacedName = def.name.startsWith('mcp__') ? def.name : `mcp__${def.name}`;
          const parts = namespacedName.split('__');
          const originalName = parts[parts.length - 1];

          // Apply per-server tool filtering
          if (serverConfig) {
            // Deny mode: skip registration entirely
            if (serverConfig.approvalMode === 'deny') continue;

            // enabledTools whitelist: only register listed tools
            if (serverConfig.enabledTools && serverConfig.enabledTools.length > 0) {
              if (!serverConfig.enabledTools.includes(originalName)) continue;
            }

            // disabledTools: skip listed tools
            if (serverConfig.disabledTools && serverConfig.disabledTools.includes(originalName)) {
              continue;
            }
          }

          const executor = client.createToolExecutor(originalName);
          // Register with the Codex-standard mcp__ prefixed name.
          this.toolRegistry.register({ ...def, name: namespacedName }, executor);

          // Add permission rule based on server approval mode
          if (serverConfig?.approvalMode === 'auto' && this.permissionManager) {
            this.permissionManager.addRule({
              tool: def.name,
              effect: 'allow',
            });
          }
        }
      } catch (error) {
        console.error(`Failed to bridge MCP tools from ${client.info?.name ?? 'unknown'}:`, error);
      }
    }

    // Re-compose system prompt now that MCP tools are registered
    this.systemPrompt = this.composeSystemPrompt();
  }

  // ----------------------------------------------------------
  // Private — System Prompt Composition
  // ----------------------------------------------------------

  /**
   * Compose the system prompt using PromptManager when available,
   * falling back to the default tool-listing prompt.
   */
  private composeSystemPrompt(): string {
    if (this.promptManager) {
      return this.promptManager.compose({
        tools: this.toolRegistry.listDefinitions(),
        skillsSummary: this.skillManager?.getSummaries() || undefined,
        memoryNotes: this.memoryManager?.getAllMemoryText() || undefined,
        workingDir: this.workingDir || undefined,
      });
    }
    return this.buildDefaultSystemPrompt();
  }

  // ----------------------------------------------------------
  // Private — Skill Injection
  // ----------------------------------------------------------

  /**
   * Check if any skills match the user message and inject their instructions.
   * Also computes skill-scoped tool constraints and stores them for tool execution.
   * On desktop, resolves dynamic context commands (!`command`) in skill instructions.
   */
  private async injectSkillContext(userMessage: string): Promise<string[]> {
    if (!this.skillManager) return [];
    this.activeSkills = [];

    const relevantSkills = this.skillManager.findRelevant(userMessage);
    if (relevantSkills.length === 0) {
      logger.debug('Skill', 'No matching skills found');
      return [];
    }

    const availableTools = this.toolRegistry.listDefinitions().map((t) => t.name);
    const usableSkills = relevantSkills.filter(
      (s) => this.skillManager!.isSkillAvailable(s, availableTools),
    );

    logger.info('Skill', 'Skills matched', {
      relevant: relevantSkills.map((s) => s.name),
      usable: usableSkills.map((s) => s.name),
      skipped: relevantSkills.filter((s) => !usableSkills.includes(s)).map((s) => s.name),
    });

    if (usableSkills.length === 0) return [];
    this.activeSkills = usableSkills;

    const allToolNames = this.toolRegistry.listDefinitions().map((t) => t.name);
    const blocks: string[] = [];
    for (const s of usableSkills) {
      let instructions = this.skillManager!.loadInstructions(s.name) ?? s.description;

      // Resolve dynamic context on desktop (!`command` pattern)
      if (this.platform.capabilities.process) {
        instructions = await this.resolveDynamicContext(instructions);
      }

      let block = `### Skill: ${s.name}\n${instructions}`;

      // Append tool constraint info for this skill
      const effectiveTools = this.skillManager!.getEffectiveTools(s, allToolNames);
      if (effectiveTools) {
        block += `\n\n**Tools available for this skill:** ${effectiveTools.join(', ')}`;
      }

      blocks.push(block);
    }
    const skillInstructions = blocks.join('\n\n');

    this.contextManager.addMessage({
      role: 'user',
      content: `[Skill Context Activated]\nThe following skills are relevant to your request:\n\n${skillInstructions}`,
    });

    return usableSkills.map((s) => s.name);
  }

  /**
   * Resolve !`command` patterns in skill instructions by executing commands.
   * Desktop only — replaces placeholders with command output.
   */
  private async resolveDynamicContext(instructions: string): Promise<string> {
    const pattern = /!`([^`]+)`/g;
    const matches: { match: string; command: string }[] = [];
    let m;
    while ((m = pattern.exec(instructions)) !== null) {
      matches.push({ match: m[0], command: m[1] });
    }
    if (matches.length === 0) return instructions;

    let result = instructions;
    for (const { match, command } of matches) {
      try {
        const { stdout, exitCode } = await this.platform.process.exec(command, {
          cwd: this.workingDir,
          timeout: 10000,
        });
        result = result.replace(match, exitCode === 0 ? stdout.trim() : `[Command failed (exit ${exitCode})]`);
      } catch (err) {
        result = result.replace(match, `[Error: ${err instanceof Error ? err.message : String(err)}]`);
      }
    }
    return result;
  }

  // ----------------------------------------------------------
  // Private — Tool Execution
  // ----------------------------------------------------------

  private buildAssistantMessage(text: string, toolCalls: ToolCall[], thinking?: string): ChatMessage {
    if (toolCalls.length === 0 && !thinking) {
      return { role: 'assistant', content: text };
    }

    const content: import('../provider/types').ContentBlock[] = [];

    if (thinking) {
      content.push({ type: 'reasoning', text: thinking });
    }

    if (text) {
      content.push({ type: 'text', text });
    }

    for (const tc of toolCalls) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.arguments,
      });
    }

    return { role: 'assistant', content };
  }

  private buildDefaultSystemPrompt(): string {
    const toolNames = this.toolRegistry
      .listDefinitions()
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    return `You are an intelligent AI assistant with access to the following tools:

${toolNames}

When you need to use a tool, invoke it with the appropriate parameters. Think step by step and explain your reasoning before taking actions. If a task requires multiple steps, break it down and use tools as needed.`;
  }

  private doneEvent(stopReason: string): AgentEvent {
    return {
      type: 'done',
      stopReason,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}
