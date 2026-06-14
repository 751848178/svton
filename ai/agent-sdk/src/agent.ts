/**
 * Agent — high-level wrapper around AgentRuntime.
 *
 * Provides a clean API for chat, tool approval, session management,
 * and dynamic tool/skill registration.
 */

import type {
  AgentEvent,
  AgentRuntime,
  ChatMessage,
  ContentBlock,
  SkillDefinition,
  ToolRegistry,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { UserToolDefinition } from './types';
import { FunctionToolExecutor } from './tool-adapter';

export class Agent {
  readonly runtime: AgentRuntime;
  readonly toolRegistry: ToolRegistry;
  readonly platform: IPlatform;

  private readonly _mcpClients: import('@svton/agent-core').MCPClient[];

  constructor(
    runtime: AgentRuntime,
    toolRegistry: ToolRegistry,
    platform: IPlatform,
    mcpClients: import('@svton/agent-core').MCPClient[] = [],
  ) {
    this.runtime = runtime;
    this.toolRegistry = toolRegistry;
    this.platform = platform;
    this._mcpClients = mcpClients;
  }

  // ============================================================
  // Core Chat
  // ============================================================

  /**
   * Send a message and stream back agent events.
   *
   * ```ts
   * for await (const event of agent.chat('Hello')) {
   *   if (event.type === 'text_delta') process.stdout.write(event.text);
   *   if (event.type === 'done') console.log('\nTokens:', event.usage);
   * }
   * ```
   */
  async *chat(message: string | ContentBlock[]): AsyncGenerator<AgentEvent> {
    yield* this.runtime.run(message);
  }

  /** Abort the current run. */
  abort(): void {
    this.runtime.abort();
  }

  // ============================================================
  // Tool Approval
  // ============================================================

  /** Approve a pending tool call (when permission mode requires approval). */
  approveToolCall(callId: string): void {
    this.runtime.approveToolCall(callId);
  }

  /** Reject a pending tool call. */
  rejectToolCall(callId: string): void {
    this.runtime.rejectToolCall(callId);
  }

  /**
   * Set the reasoning effort level for subsequent runs.
   * @param effort 'low' | 'medium' | 'high' | 'xhigh', or undefined to reset
   */
  setReasoningEffort(effort: import('@svton/agent-core').ReasoningEffort | undefined): void {
    this.runtime.setReasoningEffort(effort);
  }

  /** Get the current reasoning effort level. */
  getReasoningEffort(): import('@svton/agent-core').ReasoningEffort | undefined {
    return this.runtime.getReasoningEffort();
  }

  // ============================================================
  // Session Management
  // ============================================================

  /** Get the full conversation history. */
  getMessages(): ChatMessage[] {
    return this.runtime.getMessages();
  }

  /** Restore conversation history (e.g. loading a saved session). */
  setMessages(messages: ChatMessage[]): void {
    this.runtime.setMessages(messages);
  }

  /**
   * Save a checkpoint of the current runtime state for later resume.
   * Requires SessionResumeManager capability.
   */
  async checkpoint(sessionId: string): Promise<void> {
    const mgr = this.runtime.getResumeManager();
    if (!mgr) return;
    await mgr.checkpoint(sessionId, this.runtime);
  }

  /**
   * Restore a session from a saved checkpoint.
   * Requires SessionResumeManager capability.
   * @returns true if restored, false if no checkpoint found
   */
  async resume(sessionId: string): Promise<boolean> {
    const mgr = this.runtime.getResumeManager();
    if (!mgr) return false;
    return mgr.restore(sessionId, this.runtime);
  }

  // ============================================================
  // Dynamic Tool Management
  // ============================================================

  /** Register a custom tool at runtime. */
  addTool(tool: UserToolDefinition): void {
    this.toolRegistry.register(
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        annotations: tool.annotations,
      },
      new FunctionToolExecutor(tool.execute),
    );
  }

  /** Unregister a tool by name. */
  removeTool(name: string): void {
    this.toolRegistry.unregister(name);
  }

  // ============================================================
  // Dynamic Skill Management
  // ============================================================

  /**
   * Register a skill at runtime.
   * Requires skillManager capability to be enabled.
   */
  addSkill(skill: SkillDefinition): void {
    // Access skillManager from the runtime's capabilities
    const capabilities = (this.runtime as unknown as {
      _capabilities?: { skillManager?: { register(skill: SkillDefinition): void } };
    })._capabilities;
    if (capabilities?.skillManager) {
      capabilities.skillManager.register(skill);
    }
  }

  /**
   * Unregister a skill by name.
   * Requires skillManager capability to be enabled.
   */
  removeSkill(name: string): void {
    const capabilities = (this.runtime as unknown as {
      _capabilities?: { skillManager?: { unregister(name: string): boolean } };
    })._capabilities;
    if (capabilities?.skillManager) {
      capabilities.skillManager.unregister(name);
    }
  }

  // ============================================================
  // Cleanup
  // ============================================================

  /** Disconnect MCP clients and release resources. */
  async dispose(): Promise<void> {
    for (const client of this._mcpClients) {
      try {
        await client.disconnect();
      } catch {
        // Best-effort cleanup
      }
    }
  }
}
