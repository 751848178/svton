import 'reflect-metadata';
import { Service, observable, action, computed } from '@svton/service';
import { logger } from '@svton/agent-core';
import type {
  AgentEvent,
  AgentConfig,
  ChatMessage,
  TokenUsage,
} from '@svton/agent-core';
import { AgentRuntime } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress } from '../types';
import { SubagentSpawnExecutor, subagentSpawnDef } from '../tool/subagent-spawn';

/** Localizable strings */
const L = {
  contextCompacted: '上下文已压缩',
};

export type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress };

@Service()
export class ChatService {
  @observable() messages: DisplayMessage[] = [];
  @observable() status: ChatStatus = 'idle';
  @observable() currentModel = '';
  @observable() lastUsage: TokenUsage | null = null;
  @observable() activePlan: PlanProgress | null = null;

  private runtime: AgentRuntime | null = null;
  private platform: IPlatform | null = null;
  private pendingToolCalls = new Map<string, {
    call: import('@svton/agent-core').ToolCall;
    resolve: (approved: boolean) => void;
  }>();
  private messageCounter = 0;
  private lastEventType: string | null = null;

  @computed()
  get isStreaming(): boolean {
    return this.status === 'running';
  }

  @computed()
  get hasPendingApprovals(): boolean {
    return this.pendingToolCalls.size > 0;
  }

  /**
   * Initialize with platform and agent config.
   * Guard: skip re-initialization if already running with the same config.
   * Model switch: preserves message history and restores context to the new runtime.
   */
  @action()
  async init(platform: IPlatform, config: AgentConfig): Promise<void> {
    // Skip if already initialized with the same config (prevents state wipe during streaming)
    if (this.runtime && this.currentModel === config.model) {
      return;
    }

    // Preserve messages across model switches
    const preservedMessages = this.messages.length > 0 ? [...this.messages] : null;

    this.platform = platform;
    this.runtime = await AgentRuntime.createAsync(config, platform);

    // Wire SubagentManager post-creation (requires runtime reference)
    if (config.capabilities && !config.capabilities.subagentManager) {
      try {
        const { SubagentManager } = await import('@svton/agent-core');
        const subagentMgr = new SubagentManager(
          config,
          this.runtime,
          platform,
          config.toolRegistry,
        );
        this.runtime.setSubagentManager(subagentMgr);

        // Register subagent tool so the LLM can spawn subagents
        config.toolRegistry.register(subagentSpawnDef, new SubagentSpawnExecutor(subagentMgr));
      } catch {
        // SubagentManager not available — non-critical
      }
    }

    this.currentModel = config.model;

    // Restore preserved messages or start fresh
    if (preservedMessages) {
      this.messages = preservedMessages;
      // Feed history into the new runtime so the LLM has prior context
      const chatMessages: import('@svton/agent-core').ChatMessage[] = preservedMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          if (m.role === 'user' && m.images && m.images.length > 0) {
            const blocks: import('@svton/agent-core').ContentBlock[] = [
              ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ...m.images.map((img) => ({
                type: 'image' as const,
                data: img.data,
                mimeType: img.mimeType,
              })),
            ];
            return { role: 'user' as const, content: blocks };
          }
          if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            const blocks: import('@svton/agent-core').ContentBlock[] = [
              ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ...m.toolCalls.map((tc) => ({
                type: 'tool_use' as const,
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              })),
            ];
            return { role: 'assistant' as const, content: blocks };
          }
          return { role: m.role as 'user' | 'assistant', content: m.content };
        });
      this.runtime.setMessages(chatMessages);
      logger.info('Chat', 'Model switch — preserved messages', { messageCount: chatMessages.length });
    } else {
      this.messages = [];
    }

    this.status = 'idle';
    this.lastUsage = null;
    this.pendingToolCalls.clear();
  }

  /**
   * Send a user message and run the agent loop.
   */
  @action()
  async sendMessage(content: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    if (!this.runtime || this.status === 'running') return;

    logger.info('Chat', 'Sending message', { length: content.length, hasImages: !!images?.length });

    // Add user message
    const userMsg = this.createDisplayMessage('user', content);
    if (images && images.length > 0) {
      userMsg.images = images;
    }
    this.messages = [...this.messages, userMsg];

    await this.runAssistant(content, images);
  }

  /**
   * Retry: remove the last assistant message and regenerate.
   */
  @action()
  async retry(): Promise<void> {
    if (!this.runtime || this.status === 'running') return;
    if (this.messages.length === 0) return;

    // Find and remove the last assistant message
    const lastIdx = this.messages.length - 1;
    if (this.messages[lastIdx].role === 'assistant') {
      this.messages = this.messages.slice(0, lastIdx);
    }

    // Find the last user message content to re-run
    const lastUserMsg = [...this.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    logger.info('Chat', 'Retrying', { contentLength: lastUserMsg.content.length });
    await this.runAssistant(lastUserMsg.content);
  }

  /**
   * Edit a user message: replace it, remove all subsequent messages, re-run.
   */
  @action()
  async editMessage(messageId: string, newContent: string): Promise<void> {
    if (!this.runtime || this.status === 'running') return;

    const idx = this.messages.findIndex((m) => m.id === messageId);
    if (idx === -1 || this.messages[idx].role !== 'user') return;

    logger.info('Chat', 'Editing message', { messageId, newLength: newContent.length });

    // Update the user message content and truncate everything after
    const editedMsg = { ...this.messages[idx], content: newContent };
    this.messages = [...this.messages.slice(0, idx), editedMsg];

    await this.runAssistant(newContent);
  }

  /**
   * Core method: run the assistant and stream results.
   */
  private async runAssistant(userContent: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    // Add placeholder assistant message for streaming
    const assistantMsg = this.createDisplayMessage('assistant', '');
    assistantMsg.isStreaming = true;
    this.messages = [...this.messages, assistantMsg];
    this.status = 'running';
    this.lastEventType = null;

    try {
      // Build structured content if images are present
      const content: string | import('@svton/agent-core').ContentBlock[] = images && images.length > 0
        ? [
            ...(userContent ? [{ type: 'text' as const, text: userContent }] : []),
            ...images.map((img) => ({
              type: 'image' as const,
              data: img.data,
              mimeType: img.mimeType,
            })),
          ]
        : userContent;

      const stream = this.runtime!.run(content);

      for await (const event of stream) {
        this.handleEvent(event, assistantMsg.id);
      }
    } catch (error) {
      this.status = 'error';
      this.updateMessage(assistantMsg.id, {
        error: error instanceof Error ? error.message : String(error),
        isStreaming: false,
      });
      return;
    }

    this.status = 'idle';
    this.updateMessage(assistantMsg.id, { isStreaming: false });
  }

  /**
   * Approve a pending tool call.
   */
  @action()
  approveToolCall(callId: string): void {
    const pending = this.pendingToolCalls.get(callId);
    if (pending) {
      pending.resolve(true);
      this.pendingToolCalls.delete(callId);
      this.updateToolCallStatus(callId, 'running');
    }
    // Also notify the runtime so the ReAct loop can continue
    this.runtime?.approveToolCall(callId);
  }

  /**
   * Reject a pending tool call.
   */
  @action()
  rejectToolCall(callId: string): void {
    const pending = this.pendingToolCalls.get(callId);
    if (pending) {
      pending.resolve(false);
      this.pendingToolCalls.delete(callId);
      this.updateToolCallStatus(callId, 'error');
    }
    // Also notify the runtime
    this.runtime?.rejectToolCall(callId);
  }

  /**
   * Abort the current run.
   */
  @action()
  abort(): void {
    this.runtime?.abort();
    // Mark any streaming assistant messages as complete
    this.messages = this.messages.map((m) =>
      m.isStreaming ? { ...m, isStreaming: false } : m,
    );
    this.status = 'idle';
  }

  /**
   * Clear all messages.
   */
  @action()
  clearMessages(): void {
    this.messages = [];
    this.status = 'idle';
    this.lastUsage = null;
    this.pendingToolCalls.clear();
  }

  /**
   * Load messages from saved session data (for session switching).
   */
  @action()
  loadMessages(messages: DisplayMessage[]): void {
    this.messages = messages;
    this.status = 'idle';
    this.lastUsage = null;
    this.pendingToolCalls.clear();

    // Feed history into runtime context so the LLM has prior conversation
    if (this.runtime) {
      const chatMessages: import('@svton/agent-core').ChatMessage[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          // Restore images if present
          if (m.role === 'user' && m.images && m.images.length > 0) {
            const blocks: import('@svton/agent-core').ContentBlock[] = [
              ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ...m.images.map((img) => ({
                type: 'image' as const,
                data: img.data,
                mimeType: img.mimeType,
              })),
            ];
            return { role: 'user' as const, content: blocks };
          }

          // Restore tool calls if present (assistant messages with tool use)
          if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            const blocks: import('@svton/agent-core').ContentBlock[] = [
              ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ...m.toolCalls.map((tc) => ({
                type: 'tool_use' as const,
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              })),
            ];
            return { role: 'assistant' as const, content: blocks };
          }

          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
          };
        });
      this.runtime.setMessages(chatMessages);
      logger.info('Chat', 'Restored context to runtime', { messageCount: chatMessages.length });
    }
  }

  /**
   * Get serializable messages for saving to session.
   */
  getMessagesForSave(): DisplayMessage[] {
    return this.messages.filter(
      (m) => m.role !== 'system' && !m.isStreaming,
    );
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private createDisplayMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): DisplayMessage {
    return {
      id: `msg_${++this.messageCounter}`,
      role,
      content,
      toolCalls: [],
      timestamp: Date.now(),
    };
  }

  private updateMessage(id: string, updates: Partial<DisplayMessage>): void {
    this.messages = this.messages.map((m) =>
      m.id === id ? { ...m, ...updates } : m,
    );
  }

  private updateToolCallStatus(callId: string, status: DisplayToolCall['status']): void {
    this.messages = this.messages.map((m) => {
      if (!m.toolCalls) return m;
      const toolCalls = m.toolCalls.map((tc) =>
        tc.id === callId ? { ...tc, status } : tc,
      );
      return { ...m, toolCalls };
    });
  }

  /**
   * Update plan progress from structured tool result metadata.
   * Planning executors include a planProgress object in metadata.
   */
  private updatePlanProgress(result: import('@svton/agent-core').ToolResult): void {
    if (result.isError || !result.metadata) return;

    const progress = result.metadata.planProgress as PlanProgress | undefined;
    if (!progress || !progress.planId || !Array.isArray(progress.steps)) return;

    this.activePlan = {
      planId: progress.planId,
      title: progress.title,
      steps: progress.steps,
    };
  }

  private handleEvent(event: AgentEvent, assistantMsgId: string): void {
    switch (event.type) {
      case 'text_delta': {
        this.messages = this.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: m.content + event.text }
            : m,
        );
        break;
      }

      case 'thinking_delta': {
        // Separate thinking from different ReAct iterations with a divider
        const separator = (this.lastEventType === 'tool_call_end' || this.lastEventType === 'done')
          ? '\n---\n' : '';
        this.messages = this.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, thinking: (m.thinking || '') + separator + event.thinking }
            : m,
        );
        break;
      }

      case 'tool_call_start': {
        const toolCall: DisplayToolCall = {
          id: event.call.id,
          name: event.call.name,
          arguments: event.call.arguments,
          status: 'running',
        };

        this.messages = this.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
            : m,
        );
        break;
      }

      case 'tool_call_progress': {
        // Update tool call arguments with parsed values (tool_call_start sends empty {})
        if (event.arguments) {
          const callId = event.callId;
          this.messages = this.messages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  toolCalls: (m.toolCalls || []).map((tc) =>
                    tc.id === callId ? { ...tc, arguments: event.arguments! } : tc
                  ),
                }
              : m,
          );
        }
        break;
      }

      case 'tool_call_end': {
        const { result } = event;
        this.messages = this.messages.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                toolCalls: (m.toolCalls || []).map((tc) =>
                  tc.id === result.callId
                    ? {
                        ...tc,
                        result,
                        status: result.isError ? 'error' : 'completed',
                      }
                    : tc,
                ),
              }
            : m,
        );
        // Track plan progress from tool output
        this.updatePlanProgress(result);
        break;
      }

      case 'tool_approval_needed': {
        this.status = 'waiting_approval';
        // Store the pending call info so UI can track it
        this.pendingToolCalls.set(event.call.id, {
          call: event.call,
          resolve: () => {}, // actual resolution goes through runtime
        });
        this.updateToolCallStatus(event.call.id, 'pending_approval');
        break;
      }

      case 'error': {
        this.messages = this.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, error: event.error.message }
            : m,
        );
        break;
      }

      case 'done': {
        this.lastUsage = event.usage;
        if (this.status !== 'waiting_approval') {
          this.status = 'idle';
        }
        break;
      }

      case 'context_compacted': {
        const sysMsg = this.createDisplayMessage('system', L.contextCompacted);
        sysMsg.systemType = 'context_compacted';
        this.messages = [...this.messages, sysMsg];
        break;
      }
    }

    this.lastEventType = event.type;
  }
}
