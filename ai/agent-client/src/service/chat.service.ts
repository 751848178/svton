import 'reflect-metadata';
import { Service, observable, action, computed } from '@svton/service';
import {
  logger,
  SubagentManager,
  csvFanoutDef,
  CsvFanoutExecutor,
} from '@svton/agent-core';
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
  /** Messages for the currently active (displayed) session */
  @observable() messages: DisplayMessage[] = [];
  @observable() status: ChatStatus = 'idle';
  @observable() currentModel = '';
  @observable() lastUsage: TokenUsage | null = null;
  @observable() activePlan: PlanProgress | null = null;
  @observable() activeSessionId: string | null = null;

  private runtime: AgentRuntime | null = null;
  private runtimeWorkingDir: string | undefined = undefined;
  private runtimeConfig: AgentConfig | null = null;
  private runtimeKey: string | undefined = undefined;
  private platform: IPlatform | null = null;
  private pendingToolCalls = new Map<string, {
    call: import('@svton/agent-core').ToolCall;
    resolve: (approved: boolean) => void;
  }>();
  private messageCounter = 0;
  private lastEventType: string | null = null;

  /**
   * Callback invoked when a background stream completes.
   * The argument is the session ID of the completed stream.
   */
  onBackgroundStreamEnd: ((sessionId: string) => void) | null = null;

  /**
   * Per-session message cache. When user switches away from a session,
   * its messages are stored here. When switching back, messages are
   * restored from this cache (which may have been updated by a
   * background stream).
   */
  private sessionMessages = new Map<string, DisplayMessage[]>();

  /**
   * The session ID that currently has an active stream running in the background.
   * null if no background stream is active.
   */
  private backgroundSessionId: string | null = null;

  /**
   * The assistant message ID for the currently running (or background) stream.
   * Used to route streaming events to the correct session's message array.
   */
  private streamingAssistantMsgId: string | null = null;

  @computed()
  get isStreaming(): boolean {
    return this.status === 'running';
  }

  @computed()
  get hasPendingApprovals(): boolean {
    return this.pendingToolCalls.size > 0;
  }

  /**
   * Whether a specific session has a background stream running.
   */
  isSessionStreaming(sessionId: string): boolean {
    return this.backgroundSessionId === sessionId;
  }

  /**
   * Initialize with platform and agent config.
   * Guard: skip re-initialization if already running with the same config.
   * Model switch: preserves message history and restores context to the new runtime.
   */
  @action()
  async init(platform: IPlatform, config: AgentConfig, runtimeKey?: string): Promise<void> {
    const sameRuntime = runtimeKey
      ? this.runtimeKey === runtimeKey
      : this.runtimeConfig === config;
    if (this.runtime && sameRuntime) {
      return;
    }

    // Preserve messages across model switches
    const preservedMessages = this.messages.length > 0 ? [...this.messages] : null;

    this.platform = platform;
    this.runtime = await AgentRuntime.createAsync(config, platform);

    // Wire SubagentManager post-creation (requires runtime reference)
    if (config.capabilities && !config.capabilities.subagentManager) {
      try {
        const subagentMgr = new SubagentManager(
          config,
          this.runtime,
          platform,
          config.toolRegistry,
        );
        this.runtime.setSubagentManager(subagentMgr);
        config.capabilities.subagentManager = subagentMgr;

        // Register subagent tool so the LLM can spawn subagents
        config.toolRegistry.register(subagentSpawnDef, new SubagentSpawnExecutor(subagentMgr));

        // Register CSV fan-out tool (needs SubagentManager instance)
        if ((config.capabilities as any).csvFanoutEnabled !== false) {
          config.toolRegistry.register(csvFanoutDef, new CsvFanoutExecutor(subagentMgr));
        }
      } catch {
        // SubagentManager not available — non-critical
      }
    }

    this.currentModel = config.model;
    this.runtimeWorkingDir = config.workingDir;
    this.runtimeConfig = config;
    this.runtimeKey = runtimeKey;

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
   * Retry from a specific user message: truncate everything after it, re-run.
   */
  @action()
  async retryFromMessage(messageId: string): Promise<void> {
    if (!this.runtime || this.status === 'running') return;

    const idx = this.messages.findIndex((m) => m.id === messageId);
    if (idx === -1 || this.messages[idx].role !== 'user') return;

    const userMsg = this.messages[idx];
    this.messages = this.messages.slice(0, idx + 1);
    logger.info('Chat', 'Retrying from message', { messageId, contentLength: userMsg.content.length });
    await this.runAssistant(userMsg.content);
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
   * Events are routed to the correct session's message array:
   * - If the streaming session is the active session → update this.messages
   * - If it's in the background → update sessionMessages cache
   */
  private async runAssistant(userContent: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    // Add placeholder assistant message for streaming
    const assistantMsg = this.createDisplayMessage('assistant', '');
    assistantMsg.isStreaming = true;
    const startedAt = Date.now();
    this.messages = [...this.messages, assistantMsg];
    this.status = 'running';
    this.lastEventType = null;
    this.streamingAssistantMsgId = assistantMsg.id;
    this.backgroundSessionId = this.activeSessionId;

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

      const stream = this.runtime!.run(content, { sessionId: this.activeSessionId ?? undefined });

      for await (const event of stream) {
        this.handleEvent(event, assistantMsg.id);
      }
    } catch (error) {
      this.handleStreamEnd(assistantMsg.id, {
        error: error instanceof Error ? error.message : String(error),
        isStreaming: false,
      });
      return;
    }

    // IMPORTANT: mark isStreaming=false BEFORE setting status='idle'.
    // The status='idle' setter synchronously triggers auto-save subscribers
    // which call getMessagesForSave(). If isStreaming is still true,
    // the assistant message gets filtered out and lost.
    const duration = Date.now() - startedAt;
    this.handleStreamEnd(assistantMsg.id, { isStreaming: false, duration });
  }

  /**
   * Handle stream completion — route the finalization to the correct session.
   */
  private handleStreamEnd(
    assistantMsgId: string,
    updates: Partial<DisplayMessage>,
  ): void {
    const bgId = this.backgroundSessionId;
    const isActive = bgId === this.activeSessionId;

    if (bgId && !isActive) {
      // Stream completed in the background — update the cache only
      const cached = this.sessionMessages.get(bgId);
      if (cached) {
        const updated = cached.map((m) =>
          m.id === assistantMsgId ? { ...m, ...updates } : m,
        );
        this.sessionMessages.set(bgId, updated);
      }
      // Notify listener (useSession) that background stream completed
      // so it can save the cached messages to storage
      this.backgroundSessionId = null;
      this.streamingAssistantMsgId = null;
      if (this.onBackgroundStreamEnd) {
        this.onBackgroundStreamEnd(bgId);
      }
    } else {
      // Stream is for the active session — update this.messages directly
      this.messages = this.messages.map((m) =>
        m.id === assistantMsgId ? { ...m, ...updates } : m,
      );
      this.backgroundSessionId = null;
      this.streamingAssistantMsgId = null;
      this.status = 'idle';
    }
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
    // Mark any streaming assistant messages as complete in the active session
    this.messages = this.messages.map((m) =>
      m.isStreaming ? { ...m, isStreaming: false } : m,
    );
    // Also finalize in background cache if applicable
    if (this.backgroundSessionId) {
      const cached = this.sessionMessages.get(this.backgroundSessionId);
      if (cached) {
        this.sessionMessages.set(this.backgroundSessionId,
          cached.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m),
        );
      }
    }
    this.backgroundSessionId = null;
    this.streamingAssistantMsgId = null;
    this.status = 'idle';
  }

  /**
   * Bind this ChatService to a specific session.
   */
  @action()
  bindSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
  }

  /**
   * Set reasoning effort on the underlying runtime.
   * The change takes effect on the next run.
   */
  setReasoningEffort(effort: import('@svton/agent-core').ReasoningEffort | undefined): void {
    if (this.runtime) {
      this.runtime.setReasoningEffort(effort);
    }
  }

  /**
   * Abort if currently streaming. Returns true if an abort happened.
   */
  @action()
  abortIfStreaming(): boolean {
    if (this.status === 'running' || this.status === 'waiting_approval') {
      this.abort();
      return true;
    }
    return false;
  }

  /**
   * Cache the current messages for a session (used when switching away).
   * The stream continues running in the background, updating this cache.
   */
  cacheSessionMessages(sessionId: string, messages: DisplayMessage[]): void {
    this.sessionMessages.set(sessionId, messages);
  }

  /**
   * Get cached messages for a session (used when switching back).
   * Returns undefined if no cache exists for this session.
   */
  getCachedMessages(sessionId: string): DisplayMessage[] | undefined {
    return this.sessionMessages.get(sessionId);
  }

  /**
   * Get messages for saving, for a specific session.
   * If the session is the active one, returns current messages.
   * If it's a background session, returns from cache.
   * Filters out streaming and system messages.
   */
  getMessagesForSessionSave(sessionId: string): DisplayMessage[] {
    let msgs: DisplayMessage[];
    if (sessionId === this.activeSessionId) {
      msgs = this.messages;
    } else {
      msgs = this.sessionMessages.get(sessionId) ?? [];
    }
    return msgs.filter(
      (m) => m.role !== 'system' && !m.isStreaming,
    );
  }

  /**
   * Get serializable messages for saving the active session.
   */
  getMessagesForSave(): DisplayMessage[] {
    return this.messages.filter(
      (m) => m.role !== 'system' && !m.isStreaming,
    );
  }

  /**
   * Force-prepare messages for save — marks all as non-streaming.
   * Used for shutdown/flush saves where we must persist even in-progress messages.
   */
  forcePrepareForSave(): DisplayMessage[] {
    return this.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ ...m, isStreaming: false }));
  }

  /**
   * Clear all messages (active session only).
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
      const chatMessages: import('@svton/agent-core').ChatMessage[] = [];
      const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

      for (const m of filtered) {
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
          chatMessages.push({ role: 'user', content: blocks });
          continue;
        }

        // Restore tool calls if present (assistant messages with tool use)
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          const blocks: import('@svton/agent-core').ContentBlock[] = [
            ...(m.thinking ? [{ type: 'reasoning' as const, text: m.thinking }] : []),
            ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
            ...m.toolCalls.map((tc) => ({
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            })),
          ];
          chatMessages.push({ role: 'assistant', content: blocks });

          // Reconstruct tool_result messages so the API sees valid tool_use → tool_result pairs
          for (const tc of m.toolCalls) {
            const output = tc.result?.output ?? '';
            chatMessages.push({
              role: 'tool',
              content: [{
                type: 'tool_result' as const,
                toolUseId: tc.id,
                output: typeof output === 'string' ? output : JSON.stringify(output),
                isError: tc.result?.isError ?? tc.status === 'error',
              }],
            });
          }
          continue;
        }

        // Plain message — but assistant with thinking needs reasoning block
        if (m.role === 'assistant' && m.thinking) {
          const blocks: import('@svton/agent-core').ContentBlock[] = [
            { type: 'reasoning' as const, text: m.thinking },
            ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
          ];
          chatMessages.push({ role: 'assistant', content: blocks });
        } else {
          chatMessages.push({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          });
        }
      }
      this.runtime.setMessages(chatMessages);

      // Also restore checkpoint state (reasoning effort, plan state) if available
      const resumeMgr = this.runtime.getResumeManager();
      if (resumeMgr && this.activeSessionId) {
        resumeMgr.restore(this.activeSessionId, this.runtime).catch(() => {});
      }

      logger.info('Chat', 'Restored context to runtime', { messageCount: chatMessages.length });
    }
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
   * Also pushes/updates a plan block inline in the assistant message.
   */
  private updatePlanProgress(result: import('@svton/agent-core').ToolResult, assistantMsgId: string): void {
    if (result.isError || !result.metadata) return;

    const progress = result.metadata.planProgress as PlanProgress | undefined;
    if (!progress || !progress.planId || !Array.isArray(progress.steps)) return;

    this.activePlan = {
      planId: progress.planId,
      title: progress.title,
      steps: progress.steps,
    };

    // Push or update a plan block in the assistant message
    const bgId = this.backgroundSessionId;
    const isActive = bgId === this.activeSessionId;
    const applyPlan = (m: DisplayMessage): DisplayMessage => {
      if (m.id !== assistantMsgId) return m;
      const blocks = [...(m.blocks || [])];
      const existingIdx = blocks.findIndex(b => b.type === 'plan' && b.plan?.planId === progress.planId);
      const planBlock = { type: 'plan' as const, plan: { planId: progress.planId, title: progress.title, steps: progress.steps } };
      if (existingIdx >= 0) {
        blocks[existingIdx] = planBlock;
      } else {
        blocks.push(planBlock);
      }
      return { ...m, blocks };
    };

    if (isActive) {
      this.messages = this.messages.map(applyPlan);
    } else if (bgId) {
      const cached = this.sessionMessages.get(bgId);
      if (cached) this.sessionMessages.set(bgId, cached.map(applyPlan));
    }
  }

  /**
   * Route an event to the correct session's messages:
   * - If the streaming session IS the active session → update this.messages (observable)
   * - If it's a BACKGROUND session → update sessionMessages cache (no re-render)
   */
  private handleEvent(event: AgentEvent, assistantMsgId: string): void {
    const bgId = this.backgroundSessionId;
    const isActive = bgId === this.activeSessionId;

    switch (event.type) {
      case 'text_delta': {
        const applyText = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          const newContent = m.content + event.text;
          const blocks = [...(m.blocks || [])];
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === 'text') {
            blocks[blocks.length - 1] = { type: 'text', text: lastBlock.text + event.text };
          } else {
            blocks.push({ type: 'text', text: event.text });
          }
          return { ...m, content: newContent, blocks };
        };

        if (isActive) {
          this.messages = this.messages.map(applyText);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applyText));
        }
        break;
      }

      case 'thinking_delta': {
        const separator = (this.lastEventType === 'tool_call_end' || this.lastEventType === 'done')
          ? '\n---\n' : '';

        const applyThinking = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          const newThinking = (m.thinking || '') + separator + event.thinking;
          const blocks = [...(m.blocks || [])];

          // Check for redacted thinking content (Anthropic encrypted thinking)
          if (event.thinking.includes('__REDACTED__') || event.thinking.startsWith('[REDACTED]')) {
            blocks.push({ type: 'redacted_thinking', reason: 'Provider returned encrypted thinking content' });
            return { ...m, thinking: newThinking, blocks };
          }

          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === 'thinking') {
            blocks[blocks.length - 1] = { type: 'thinking', text: lastBlock.text + separator + event.thinking };
          } else {
            blocks.push({ type: 'thinking', text: event.thinking });
          }
          return { ...m, thinking: newThinking, blocks };
        };

        if (isActive) {
          this.messages = this.messages.map(applyThinking);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applyThinking));
        }
        break;
      }

      case 'tool_call_start': {
        const toolCall: DisplayToolCall = {
          id: event.call.id,
          name: event.call.name,
          arguments: event.call.arguments,
          status: 'running',
        };

        const isSubagent = event.call.name === 'subagent_spawn' || event.call.name === 'spawn_subagent';
        const SLOW_TOOLS = new Set(['grep', 'glob', 'file_read', 'read', 'web_search', 'list_files', 'list_dir']);
        const isSlowTool = SLOW_TOOLS.has(event.call.name);

        const applyToolStart = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          const blocks = [...(m.blocks || [])];
          // Push a transient progress indicator for slow tools
          if (isSlowTool && !isSubagent) {
            const verb = event.call.name === 'web_search' ? 'Searching the web'
              : event.call.name === 'grep' || event.call.name === 'glob' ? 'Searching codebase'
              : event.call.name === 'file_read' || event.call.name === 'read' ? 'Reading file'
              : 'Listing files';
            blocks.push({ type: 'progress', text: verb, status: 'running' });
          }
          if (isSubagent) {
            const task = (event.call.arguments as any)?.task || 'Subagent task';
            blocks.push({ type: 'subagent', agentId: event.call.id, task, status: 'running' });
          } else {
            blocks.push({ type: 'tool_call', call: toolCall });
          }
          return { ...m, toolCalls: [...(m.toolCalls || []), toolCall], blocks };
        };

        if (isActive) {
          this.messages = this.messages.map(applyToolStart);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applyToolStart));
        }
        break;
      }

      case 'tool_call_progress': {
        if (event.arguments) {
          const callId = event.callId;
          const applyProgress = (m: DisplayMessage): DisplayMessage => {
            if (m.id !== assistantMsgId) return m;
            const updatedCalls = (m.toolCalls || []).map((tc) =>
              tc.id === callId ? { ...tc, arguments: event.arguments! } : tc
            );
            const blocks = (m.blocks || []).map((b) =>
              b.type === 'tool_call' && b.call.id === callId
                ? { ...b, call: { ...b.call, arguments: event.arguments! } }
                : b
            );
            return { ...m, toolCalls: updatedCalls, blocks };
          };

          if (isActive) {
            this.messages = this.messages.map(applyProgress);
          } else if (bgId) {
            const cached = this.sessionMessages.get(bgId);
            if (cached) this.sessionMessages.set(bgId, cached.map(applyProgress));
          }
        }
        break;
      }

      case 'tool_call_end': {
        const { result } = event;
        const endStatus = result.isError ? 'error' as const : 'completed' as const;

        // Find the tool call to determine its name for special handling
        const lastMsg = isActive
          ? this.messages.find((m) => m.id === assistantMsgId)
          : bgId ? (this.sessionMessages.get(bgId)?.find((m) => m.id === assistantMsgId)) : undefined;
        const tc = lastMsg?.toolCalls?.find((t) => t.id === result.callId);
        const toolName = tc?.name || '';

        // Detect file-changing tools
        const FILE_TOOLS = new Set(['file_write', 'file_edit', 'write_file', 'edit_file', 'apply_diff']);
        const isFileChange = FILE_TOOLS.has(toolName) && !result.isError;
        const isSubagentTool = toolName === 'subagent_spawn' || toolName === 'spawn_subagent';

        const applyEnd = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          const updatedCalls = (m.toolCalls || []).map((tc2) =>
            tc2.id === result.callId
              ? { ...tc2, result, status: endStatus }
              : tc2
          );
          let blocks = (m.blocks || []).map((b) => {
            // Update tool_call block
            if (b.type === 'tool_call' && b.call.id === result.callId) {
              return { ...b, call: { ...b.call, result, status: endStatus } };
            }
            // Update subagent block
            if (b.type === 'subagent' && b.agentId === result.callId) {
              return { ...b, status: 'completed' as const, summary: result.output };
            }
            return b;
          });

          // Push a file_change block for file-editing tools
          if (isFileChange && tc) {
            const filePath = (tc.arguments as any)?.path || (tc.arguments as any)?.file_path || 'unknown';
            const existingIdx = blocks.findIndex(b => b.type === 'file_change');
            const changeType = toolName.includes('write') || toolName.includes('create') ? 'create' : 'modify';
            const newChange = { path: filePath, changeType: changeType as 'create' | 'modify', diff: result.output };
            if (existingIdx >= 0 && blocks[existingIdx].type === 'file_change') {
              const existing = blocks[existingIdx];
              blocks[existingIdx] = { ...existing, changes: [...(existing.changes || []), newChange] };
            } else {
              blocks.push({ type: 'file_change', changes: [newChange] });
            }
          }

          // Push a reference block for file-reading tools
          const READ_TOOLS = new Set(['file_read', 'read', 'read_file']);
          if (READ_TOOLS.has(toolName) && tc && !result.isError) {
            const filePath = (tc.arguments as any)?.path || (tc.arguments as any)?.file_path || '';
            if (filePath) {
              blocks.push({ type: 'reference', refs: [{ path: filePath }] });
            }
          }

          // Push a web_search block from metadata
          if (toolName === 'web_search' && result.metadata?.searchResults && !result.isError) {
            const searchResults = result.metadata.searchResults as any[];
            const query = result.metadata.query as string || (tc?.arguments as any)?.query || '';
            blocks.push({
              type: 'web_search',
              query,
              results: searchResults.map((r: any) => ({
                title: r.title || '',
                url: r.url || '',
                snippet: r.snippet,
              })),
            });
          }

          // Push a file_tree block for list_files/dir tools
          const LIST_TOOLS = new Set(['list_files', 'list_dir', 'ls', 'glob']);
          if (LIST_TOOLS.has(toolName) && !result.isError) {
            try {
              const parsed = JSON.parse(result.output);
              if (Array.isArray(parsed)) {
                const tree = parsed.map((item: any) => ({
                  name: item.name || item.path?.split('/').pop() || 'unknown',
                  type: item.isDirectory || item.type === 'dir' || item.type === 'directory' ? 'dir' as const : 'file' as const,
                  children: item.children,
                }));
                if (tree.length > 0) {
                  blocks.push({ type: 'file_tree', tree });
                }
              }
            } catch { /* not JSON, skip */ }
          }

          // Push an image_generated block for image_generate tool
          if (toolName === 'image_generate' && !result.isError) {
            try {
              const parsed = JSON.parse(result.output);
              if (parsed.images || parsed.image) {
                const images = parsed.images || [parsed.image];
                blocks.push({
                  type: 'image_generated',
                  images: images.map((img: any) => ({
                    url: img.url,
                    base64: img.base64,
                    revisedPrompt: img.revisedPrompt || img.revised_prompt,
                  })),
                  model: parsed.model || (tc?.arguments as any)?.model || 'unknown',
                });
              }
            } catch { /* not JSON, skip */ }
          }

          // Push a csv_fanout block
          if (toolName === 'csv_fanout' && !result.isError) {
            try {
              const parsed = JSON.parse(result.output);
              if (parsed.totalRows !== undefined) {
                blocks.push({
                  type: 'csv_fanout',
                  totalRows: parsed.totalRows,
                  succeeded: parsed.succeeded,
                  failed: parsed.failed,
                  rows: [],
                });
              }
            } catch { /* not JSON, skip */ }
          }

          // Push a code_review block for git_diff results
          if (toolName === 'git_diff' && !result.isError && result.output) {
            // Parse diff for basic findings (files changed, additions, deletions)
            const lines = result.output.split('\n');
            const findings: any[] = [];
            for (const line of lines) {
              if (line.startsWith('+++ ') || line.startsWith('--- ')) {
                const path = line.replace(/^(\+\+\+|---) /, '').replace(/^b\//, '').replace(/^a\//, '');
                if (path !== '/dev/null') {
                  findings.push({ file: path, severity: 'info' as const, comment: '文件变更' });
                }
              }
            }
            if (findings.length > 0) {
              blocks.push({ type: 'code_review', findings: findings.slice(0, 10) });
            }
          }

          // Push an auto_review block from AutoReviewerManager verdicts
          if (result.metadata?.autoReviewVerdict && !result.isError) {
            const verdict = result.metadata.autoReviewVerdict as any;
            blocks.push({
              type: 'auto_review',
              toolName,
              verdict: verdict.verdict || 'approve',
              reason: verdict.reason || '',
              ruleId: verdict.ruleId,
            });
          }

          // Push a preview_images block for preview_document results
          if (toolName === 'preview_document' && !result.isError && result.metadata?.previewResult) {
            const previewResult = result.metadata.previewResult as any;
            if (previewResult.kind === 'images' && previewResult.images?.length > 0) {
              blocks.push({
                type: 'preview_images',
                images: previewResult.images,
                title: (tc?.arguments as any)?.path || 'Document Preview',
              } as any);
            }
          }

          // Update progress blocks to done
          blocks = blocks.map((b) =>
            b.type === 'progress' && b.status === 'running'
              ? { ...b, status: 'done' as const }
              : b
          );

          return { ...m, toolCalls: updatedCalls, blocks };
        };

        if (isActive) {
          this.messages = this.messages.map(applyEnd);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applyEnd));
        }
        this.updatePlanProgress(result, assistantMsgId);
        break;
      }

      case 'tool_approval_needed': {
        this.status = 'waiting_approval';
        this.pendingToolCalls.set(event.call.id, {
          call: event.call,
          resolve: () => {},
        });
        // Only update displayed messages if it's the active session
        if (isActive) {
          this.updateToolCallStatus(event.call.id, 'pending_approval');
        }
        break;
      }

      case 'error': {
        const applyError = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          const blocks = [...(m.blocks || [])];
          blocks.push({ type: 'error', text: event.error.message });
          return { ...m, error: event.error.message, blocks };
        };

        if (isActive) {
          this.messages = this.messages.map(applyError);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applyError));
        }
        break;
      }

      case 'done': {
        this.lastUsage = event.usage;
        // Post-process: extract commands from text, aggregate file_changes
        const applyTurnDiff = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          let blocks = [...(m.blocks || [])];

          // Extract command blocks from text ([label](action:xxx) patterns)
          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (block.type === 'text' && block.text) {
              const cmdPattern = /\[([^\]]+)\]\(action:([^)]+)\)/g;
              let match;
              const commands: any[] = [];
              while ((match = cmdPattern.exec(block.text)) !== null) {
                commands.push({ type: 'command', label: match[1], action: match[2] });
              }
              if (commands.length > 0) {
                const cleanText = block.text.replace(cmdPattern, '').trim();
                blocks[i] = { type: 'text', text: cleanText };
                blocks.push(...commands);
              }
            }
          }

          // Aggregate file_change blocks into turn_diff
          const fileChanges = blocks.filter(b => b.type === 'file_change');
          if (fileChanges.length >= 2) {
            // Collect all changes from all file_change blocks
            const allChanges = fileChanges.flatMap(b =>
              b.type === 'file_change' ? b.changes : []
            );
            // Replace individual file_change blocks with a single turn_diff
            const filtered = blocks.filter(b => b.type !== 'file_change');
            filtered.push({ type: 'turn_diff', changes: allChanges });
            return { ...m, blocks: filtered };
          }
          return m;
        };
        if (isActive) {
          this.messages = this.messages.map(applyTurnDiff);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applyTurnDiff));
        }
        // Only update status for the active session.
        if (isActive && this.status !== 'waiting_approval') {
          this.status = 'idle';
        }
        break;
      }

      case 'context_compacted': {
        if (isActive) {
          const sysMsg = this.createDisplayMessage('system', L.contextCompacted);
          sysMsg.systemType = 'context_compacted';
          this.messages = [...this.messages, sysMsg];
        }
        break;
      }

      case 'warning': {
        const applyWarning = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          const blocks = [...(m.blocks || [])];
          blocks.push({ type: 'warning', text: event.text, source: event.source });
          return { ...m, blocks };
        };

        if (isActive) {
          this.messages = this.messages.map(applyWarning);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applyWarning));
        }
        break;
      }
    }

    this.lastEventType = event.type;
  }
}
