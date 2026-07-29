/** Pi owns loop, canonical messages, and tool scheduling; this class wires
 * svton capabilities around it (Arch §3, §7.2). Supporting responsibilities
 * live in runtime-*, approval-gate, compactor, and message-bridge modules. */
import { Agent, type AgentMessage } from '@earendil-works/pi-agent-core';
import type { Models, Model } from '@earendil-works/pi-ai';
import type { ChatMessage, ContentBlock, ReasoningEffort, TokenUsage } from '../provider/types';
import type { ToolRegistry } from '../tool/registry';
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
import type { IPlatform } from '@svton/agent-platform';
import type { AgentConfig, AgentEvent, IRuntime, McpServerToolConfig, PendingApproval, RunOptions } from './types';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { AgentDefinitionManager } from '../agent-definition/manager';
import { ToolExecutionService } from './tool-executor';
import { logger } from '../utils/logger';
import { toAgentMessages, toChatMessages } from './message-bridge';
import { SvtonCompactor } from './svton-compactor';
import { ApprovalGate } from './approval-gate';
import type { ToolEventSink } from './pi-tool-adapter';
import { buildPiAgent, rebuildTools } from './runtime-compose';
import { bridgeMcpTools, composeSystemPrompt, type CapabilityContext } from './runtime-capabilities';
import { runOnce } from './runtime-run';
import { createPostTurnCallback, type PostTurnDeps } from './runtime-lifecycle';
import { reasoningToThinkingLevel, resolveModelById } from './runtime-helpers';

const DEFAULT_MAX_ITERATIONS = 50;

/** Composition root over the Pi `Agent`. */
export class SvtonAgentRuntime implements IRuntime {
  private readonly models: Models;
  private readonly model: Model<any>;
  private readonly modelId: string;
  private readonly toolRegistry: ToolRegistry;
  private systemPrompt: string;
  private readonly maxIterations: number;
  private readonly workingDir: string;
  private readonly agent: Agent;
  private readonly compactor: SvtonCompactor;
  private readonly approvalGate = new ApprovalGate();
  private readonly skillManager: SkillManager | null;
  private readonly memoryManager: MemoryManager | null;
  private readonly promptManager: PromptManager | null;
  private permissionManager: PermissionManager | null;
  private hookManager: HookManager | null;
  private readonly mcpClients: MCPClient[];
  private readonly mcpServerConfigs: Map<string, McpServerToolConfig>;
  private subagentManager: SubagentManager | null;
  private readonly planningManager: PlanningManager | null;
  private readonly resumeManager: SessionResumeManager | null;
  private readonly autoReviewer: AutoReviewerManager | null;
  private readonly agentDefinitionManager: AgentDefinitionManager | null;
  private reasoningEffort: ReasoningEffort | undefined;
  private activeSkills: SkillDefinition[] = [];
  private toolExecService: ToolExecutionService;
  private readonly platform: IPlatform;
  private currentToolSink: ToolEventSink | null = null;

  private constructor(config: AgentConfig, platform: IPlatform) {
    this.models = config.models;
    this.model = config.piModel ?? resolveModelById(this.models, config.model);
    this.modelId = config.model;
    this.toolRegistry = config.toolRegistry;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.workingDir = config.workingDir || '/';
    this.platform = platform;
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
    this.systemPrompt = config.systemPrompt || composeSystemPrompt(this.capabilityContext());
    this.compactor = new SvtonCompactor(config.contextConfig);
    this.compactor.bind(this.models, this.model);
    this.toolExecService = this.buildToolExecService();
    this.agent = this.buildAgent(config);
  }
  static create(config: AgentConfig, platform: IPlatform): SvtonAgentRuntime {
    return new SvtonAgentRuntime(config, platform);
  }
  static async createAsync(config: AgentConfig, platform: IPlatform): Promise<SvtonAgentRuntime> {
    const rt = new SvtonAgentRuntime(config, platform);
    await bridgeMcpTools(rt.capabilityContext());
    rt.systemPrompt = composeSystemPrompt(rt.capabilityContext());
    rt.agent.state.systemPrompt = rt.systemPrompt;
    return rt;
  }
  async *run(userMessage: string | ContentBlock[], options?: RunOptions): AsyncGenerator<AgentEvent> {
    yield* runOnce({
      agent: this.agent, toolRegistry: this.toolRegistry, toolExecService: this.toolExecService,
      hookManager: this.hookManager, platform: this.platform, workingDir: this.workingDir,
      autoReviewer: this.autoReviewer, resumeManager: this.resumeManager,
      capabilityContext: this.capabilityContext(), maxIterations: this.maxIterations,
      onActiveSkills: (s) => { this.activeSkills = s; },
      refreshTools: (sink) => this.refreshTools(sink),
      postTurn: createPostTurnCallback(this.postTurnDeps()),
    }, userMessage, options, (reason, usage) => this.doneEvent(reason, usage as TokenUsage | undefined));
  }

  approveToolCall(callId: string): void { this.approvalGate.approveToolCall(callId); }
  rejectToolCall(callId: string): void { this.approvalGate.rejectToolCall(callId); }
  abort(): void { this.agent.abort(); this.approvalGate.abortPending(); }
  getMessages(): ChatMessage[] { return toChatMessages(this.agent.state.messages); }
  setMessages(messages: ChatMessage[]): void { this.agent.state.messages = toAgentMessages(messages); }
  getCanonicalMessages(): AgentMessage[] { return [...this.agent.state.messages]; }
  rollbackCanonicalMessages(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > this.agent.state.messages.length) throw new RangeError(`Invalid canonical message index: ${index}`);
    this.agent.state.messages = this.agent.state.messages.slice(0, index);
  }
  getModel(): string { return this.modelId; }
  setSubagentManager(manager: SubagentManager): void { this.subagentManager = manager; }
  setPermissionManager(manager: PermissionManager): void { this.permissionManager = manager; this.toolExecService = this.buildToolExecService(); }
  setHookManager(manager: HookManager): void { this.hookManager = manager; this.toolExecService = this.buildToolExecService(); }
  setReasoningEffort(effort: ReasoningEffort | undefined): void { this.reasoningEffort = effort; this.agent.state.thinkingLevel = reasoningToThinkingLevel(effort); }
  getReasoningEffort(): ReasoningEffort | undefined { return this.reasoningEffort; }
  getResumeManager(): SessionResumeManager | null { return this.resumeManager; }
  getAgentDefinitionManager(): AgentDefinitionManager | null { return this.agentDefinitionManager; }

  switchAgentDefinition(name: string): boolean {
    const def = this.agentDefinitionManager?.get(name);
    if (!def) return false;
    if (def.systemPrompt) {
      this.promptManager?.clearInstructions();
      this.promptManager?.addInstructions(def.systemPrompt);
      this.systemPrompt = composeSystemPrompt(this.capabilityContext());
      this.agent.state.systemPrompt = this.systemPrompt;
    }
    if (def.permissions && this.permissionManager) this.permissionManager.setMode(def.permissions);
    logger.info('Runtime', `Switched to agent: ${name}`, { model: def.model, permissions: def.permissions });
    return true;
  }

  // ----------------------------------------------------------
  // Private — composition
  // ----------------------------------------------------------

  private buildAgent(config: AgentConfig): Agent {
    return buildPiAgent({
      systemPrompt: this.systemPrompt, model: this.model, models: this.models,
      toolRegistry: this.toolRegistry, toolExecService: this.toolExecService,
      compactor: this.compactor, approvalGate: this.approvalGate,
      initialMessages: config.initialMessages,
      // Apply an initial thinking level from the config so the Pi Agent streams
      // thinking when reasoning is configured (e.g. the web E2E thinking path).
      thinkingLevel: config.reasoningEffort
        ? reasoningToThinkingLevel(config.reasoningEffort) as 'low' | 'medium' | 'high' | 'xhigh'
        : undefined,
      routeToolEvent: (ev) => this.routeToolEvent(ev),
    });
  }

  private buildToolExecService(): ToolExecutionService {
    return new ToolExecutionService(
      this.toolRegistry, this.platform, this.workingDir, this.permissionManager, this.hookManager,
      this.approvalGate.pendingApprovals as Map<string, PendingApproval>,
    );
  }

  private routeToolEvent(ev: AgentEvent): void { this.currentToolSink?.(ev); }

  private refreshTools(sink: ToolEventSink): void {
    this.currentToolSink = sink;
    this.agent.state.tools = rebuildTools(this.toolRegistry, this.toolExecService, (ev) => this.routeToolEvent(ev));
  }

  private capabilityContext(): CapabilityContext {
    return {
      platform: this.platform, workingDir: this.workingDir, toolRegistry: this.toolRegistry,
      promptManager: this.promptManager, skillManager: this.skillManager, memoryManager: this.memoryManager,
      permissionManager: this.permissionManager, mcpClients: this.mcpClients, mcpServerConfigs: this.mcpServerConfigs,
    };
  }

  private postTurnDeps(): PostTurnDeps {
    return {
      memoryManager: this.memoryManager, models: this.models, model: this.model,
      modelId: this.modelId, resumeManager: this.resumeManager, runtime: this,
      getMessages: () => this.getMessages(),
    };
  }

  private doneEvent(stopReason: string, usage?: TokenUsage): AgentEvent {
    return { type: 'done', stopReason, usage: usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  }
}
