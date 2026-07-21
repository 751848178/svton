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
import {
  finalizeStalePendingApprovals,
  updateToolCallStatusInMessages,
} from './chat-message-tool-status.utils';
import { appendToolResultMetadataBlocks } from './chat-tool-result-blocks.utils';
import {
  insertSlowToolProgressBlock,
  markSlowToolProgressBlockDone,
  readSlowToolProgressBlock,
} from './chat-tool-progress-block.utils';
import { finalizeTurnBlocks } from './chat-turn-blocks.utils';

const L = {
  contextCompacted: '上下文已压缩',
};

const INPUT_HISTORY_KEY = 'agent:input_history:v1';
const MAX_INPUT_HISTORY_ITEMS = 100;
const MAX_INPUT_HISTORY_CHARS = 20000;

export type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress };

@Service()
export class ChatService {
  @observable() messages: DisplayMessage[] = [];
  @observable() status: ChatStatus = 'idle';
  @observable() currentModel = '';
  @observable() lastUsage: TokenUsage | null = null;
  @observable() activePlan: PlanProgress | null = null;
  @observable() activeSessionId: string | null = null;
  @observable() inputHistory: string[] = [];
  @observable() pendingApprovalVersion = 0;
  private runtime: AgentRuntime | null = null;
  private runtimeWorkingDir: string | undefined = undefined;
  private runtimeConfig: AgentConfig | null = null;
  private runtimeKey: string | undefined = undefined;
  private platform: IPlatform | null = null;
  private pendingToolCalls = new Map<string, {
    call: import('@svton/agent-core').ToolCall;
    metadata?: Record<string, unknown>;
    resolve: (approved: boolean) => void;
  }>();
  private messageCounter = 0;
  private lastEventType: string | null = null;
  private inputHistoryLoaded = false;
  private pendingInputHistoryValues: string[] = [];
  onBackgroundStreamEnd: ((sessionId: string) => void) | null = null;
  private sessionMessages = new Map<string, DisplayMessage[]>();
  private backgroundSessionId: string | null = null;
  private streamingAssistantMsgId: string | null = null;

  @computed()
  get isStreaming(): boolean {
    return this.status === 'running' || this.status === 'waiting_approval';
  }

  @computed()
  get hasPendingApprovals(): boolean {
    return this.pendingToolCalls.size > 0;
  }

  getPendingToolCalls(): DisplayToolCall[] {
    return Array.from(this.pendingToolCalls.values()).map(({ call, metadata }) => ({
      id: call.id,
      name: call.name,
      arguments: call.arguments ?? {},
      ...(metadata ? { metadata } : {}),
      status: 'pending_approval',
    }));
  }

  private bumpPendingApprovals(): void {
    this.pendingApprovalVersion += 1;
  }

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

    if (this.pendingToolCalls.size > 0) {
      this.runtime?.abort();
      for (const callId of this.pendingToolCalls.keys()) {
        this.updateToolCallStatus(callId, 'error');
      }
      this.pendingToolCalls.clear();
      this.bumpPendingApprovals();
    }

    const preservedMessages = this.messages.length > 0 ? [...this.messages] : null;

    this.platform = platform;
    await this.loadInputHistory();
    this.runtime = await AgentRuntime.createAsync(config, platform);

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

        config.toolRegistry.register(subagentSpawnDef, new SubagentSpawnExecutor(subagentMgr));

        if ((config.capabilities as any).csvFanoutEnabled !== false) {
          config.toolRegistry.register(csvFanoutDef, new CsvFanoutExecutor(subagentMgr));
        }
      } catch {}
    }

    this.currentModel = config.model;
    this.runtimeWorkingDir = config.workingDir;
    this.runtimeConfig = config;
    this.runtimeKey = runtimeKey;

    if (preservedMessages) {
      this.messages = preservedMessages;
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
  }

  /**
   * Send a user message and run the agent loop.
   */
  @action()
  async sendMessage(content: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    if (!this.runtime || this.isStreaming) return;

    logger.info('Chat', 'Sending message', { length: content.length, hasImages: !!images?.length });
    this.recordInputHistory(content);

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
    if (!this.runtime || this.isStreaming) return;
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
    if (!this.runtime || this.isStreaming) return;

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
    if (!this.runtime || this.isStreaming) return;

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
        if (event.type === 'done') break;
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

  @action()
  approveToolCall(callId: string): void {
    const pending = this.pendingToolCalls.get(callId);
    if (pending) {
      pending.resolve(true);
      this.pendingToolCalls.delete(callId);
      this.bumpPendingApprovals();
    }
    this.updateToolCallStatus(callId, 'running');
    // Also notify the runtime so the ReAct loop can continue
    this.runtime?.approveToolCall(callId);
  }

  @action()
  rejectToolCall(callId: string): void {
    const pending = this.pendingToolCalls.get(callId);
    if (pending) {
      pending.resolve(false);
      this.pendingToolCalls.delete(callId);
      this.bumpPendingApprovals();
    }
    this.updateToolCallStatus(callId, 'error');
    // Also notify the runtime
    this.runtime?.rejectToolCall(callId);
  }

  @action()
  abort(): void {
    this.runtime?.abort();
    const bgId = this.backgroundSessionId;
    const shouldNotifyBackgroundEnd = !!bgId && bgId !== this.activeSessionId;
    for (const callId of this.pendingToolCalls.keys()) {
      this.updateToolCallStatus(callId, 'error');
    }
    if (this.pendingToolCalls.size > 0) {
      this.pendingToolCalls.clear();
      this.bumpPendingApprovals();
    }
    // Mark any streaming assistant messages as complete in the active session
    this.messages = finalizeStalePendingApprovals(this.messages)
      .map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
    // Also finalize in background cache if applicable
    if (bgId) {
      const cached = this.sessionMessages.get(bgId);
      if (cached) {
        this.sessionMessages.set(bgId,
          finalizeStalePendingApprovals(cached)
            .map((m) => m.isStreaming ? { ...m, isStreaming: false } : m),
        );
      }
    }
    this.backgroundSessionId = null;
    this.streamingAssistantMsgId = null;
    this.status = 'idle';
    if (shouldNotifyBackgroundEnd && bgId) {
      this.onBackgroundStreamEnd?.(bgId);
    }
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
    const messages = this.messages.filter((m) => m.role !== 'system');
    return finalizeStalePendingApprovals(messages)
      .map((m) => ({ ...m, isStreaming: false }));
  }

  @action()
  clearMessages(options?: { preservePendingToolCalls?: boolean }): void {
    this.messages = [];
    this.status = 'idle';
    this.lastUsage = null;
    if (!options?.preservePendingToolCalls && this.pendingToolCalls.size > 0) {
      this.pendingToolCalls.clear();
      this.bumpPendingApprovals();
    }
  }

  @action()
  loadMessages(messages: DisplayMessage[], options?: { preservePendingToolCalls?: boolean }): void {
    const loadedMessages = options?.preservePendingToolCalls
      ? messages
      : finalizeStalePendingApprovals(messages);
    this.messages = loadedMessages;
    this.status = 'idle';
    this.lastUsage = null;
    if (!options?.preservePendingToolCalls && this.pendingToolCalls.size > 0) {
      this.pendingToolCalls.clear();
      this.bumpPendingApprovals();
    }
    this.recordMessagesInInputHistory(loadedMessages);

    if (this.runtime) {
      const chatMessages: import('@svton/agent-core').ChatMessage[] = [];
      const filtered = loadedMessages.filter((m) => m.role === 'user' || m.role === 'assistant');

      for (const m of filtered) {
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

  private async loadInputHistory(): Promise<void> {
    if (this.inputHistoryLoaded || !this.platform) return;

    try {
      const raw = await this.platform.storage.get<unknown>(INPUT_HISTORY_KEY);
      const stored = Array.isArray(raw) ? raw : [];
      const pending = this.pendingInputHistoryValues;
      this.pendingInputHistoryValues = [];
      const next = this.normalizeInputHistory([...stored, ...pending]);
      this.inputHistory = next;
      this.inputHistoryLoaded = true;
      if (pending.length > 0) {
        void this.persistInputHistory(next);
      }
    } catch (error) {
      this.inputHistoryLoaded = true;
      logger.warn('Chat', 'Failed to load input history', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private recordMessagesInInputHistory(messages: DisplayMessage[]): void {
    const userInputs = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content);

    this.addInputHistoryItems(userInputs, false);
  }

  private recordInputHistory(content: string): void {
    this.addInputHistoryItems([content]);
  }

  private addInputHistoryItems(values: unknown[], moveExistingToEnd = true): void {
    const items = this.normalizeInputHistory(values);
    if (items.length === 0) return;

    if (!this.inputHistoryLoaded) {
      this.pendingInputHistoryValues = this.mergeInputHistory(
        this.pendingInputHistoryValues,
        items,
        moveExistingToEnd,
      );
      const optimistic = this.mergeInputHistory(this.inputHistory, items, moveExistingToEnd);
      if (!this.areStringArraysEqual(this.inputHistory, optimistic)) {
        this.inputHistory = optimistic;
      }
      return;
    }

    this.setInputHistory(this.mergeInputHistory(this.inputHistory, items, moveExistingToEnd));
  }

  private setInputHistory(values: unknown[]): void {
    const next = this.normalizeInputHistory(values);
    if (this.areStringArraysEqual(this.inputHistory, next)) return;

    this.inputHistory = next;
    void this.persistInputHistory(next);
  }

  private normalizeInputHistory(values: unknown[]): string[] {
    const normalized: string[] = [];

    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.length > MAX_INPUT_HISTORY_CHARS) continue;

      const existingIndex = normalized.indexOf(trimmed);
      if (existingIndex !== -1) normalized.splice(existingIndex, 1);
      normalized.push(trimmed);
    }

    return normalized.slice(-MAX_INPUT_HISTORY_ITEMS);
  }

  private mergeInputHistory(
    base: unknown[],
    values: unknown[],
    moveExistingToEnd: boolean,
  ): string[] {
    const merged = this.normalizeInputHistory(base);

    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.length > MAX_INPUT_HISTORY_CHARS) continue;

      const existingIndex = merged.indexOf(trimmed);
      if (existingIndex !== -1) {
        if (!moveExistingToEnd) continue;
        merged.splice(existingIndex, 1);
      }
      merged.push(trimmed);
    }

    return merged.slice(-MAX_INPUT_HISTORY_ITEMS);
  }

  private async persistInputHistory(history: string[]): Promise<void> {
    if (!this.platform) return;

    try {
      await this.platform.storage.set(INPUT_HISTORY_KEY, history);
    } catch (error) {
      logger.warn('Chat', 'Failed to persist input history', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private areStringArraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  private updateMessage(id: string, updates: Partial<DisplayMessage>): void {
    this.messages = this.messages.map((m) =>
      m.id === id ? { ...m, ...updates } : m,
    );
  }

  private updateToolCallStatus(
    callId: string,
    status: DisplayToolCall['status'],
    metadata?: Record<string, unknown>,
  ): void {
    this.messages = updateToolCallStatusInMessages(this.messages, callId, status, metadata);
    for (const [sessionId, messages] of this.sessionMessages.entries()) {
      this.sessionMessages.set(sessionId, updateToolCallStatusInMessages(messages, callId, status, metadata));
    }
  }

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
        const progressBlock = readSlowToolProgressBlock(event.call.name);

        const applyToolStart = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          const blocks = [...(m.blocks || [])];
          if (progressBlock && !isSubagent) blocks.push(progressBlock);
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
        if (event.arguments || event.name) {
          const callId = event.callId;
          const applyProgress = (m: DisplayMessage): DisplayMessage => {
            if (m.id !== assistantMsgId) return m;
            const updatedCalls = (m.toolCalls || []).map((tc) =>
              tc.id === callId
                ? {
                    ...tc,
                    name: event.name ?? tc.name,
                    arguments: event.arguments ?? tc.arguments,
                  }
                : tc
            );
            const blocks = (m.blocks || []).map((b) => {
              if (b.type !== 'tool_call' || b.call.id !== callId) return b;
              const name = event.name ?? b.call.name;
              const args = event.arguments ?? b.call.arguments;
              if (name === 'subagent_spawn' || name === 'spawn_subagent') {
                const task = (args as any)?.task;
                return {
                  type: 'subagent' as const,
                  agentId: callId,
                  task: typeof task === 'string' && task.trim().length > 0 ? task : 'Subagent task',
                  status: 'running' as const,
                };
              }
              return { ...b, call: { ...b.call, name, arguments: args } };
            });
            return {
              ...m,
              toolCalls: updatedCalls,
              blocks: insertSlowToolProgressBlock(blocks, callId, event.name),
            };
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
              return { ...b, status: result.isError ? 'error' as const : 'completed' as const, summary: result.output };
            }
            return b;
          });

          blocks = appendToolResultMetadataBlocks(blocks, toolName, result, tc);
          blocks = markSlowToolProgressBlockDone(blocks, result.callId);

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
          ...(event.metadata ? { metadata: event.metadata } : {}),
          resolve: () => {},
        });
        this.bumpPendingApprovals();
        this.updateToolCallStatus(event.call.id, 'pending_approval', event.metadata);
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
        const applyTurnDiff = (m: DisplayMessage): DisplayMessage => {
          if (m.id !== assistantMsgId) return m;
          return finalizeTurnBlocks(m);
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

      case 'skill_activated': {
        const applySkill = (m: DisplayMessage): DisplayMessage =>
          m.id === assistantMsgId
            ? { ...m, activeSkills: event.skills }
            : m;

        if (isActive) {
          this.messages = this.messages.map(applySkill);
        } else if (bgId) {
          const cached = this.sessionMessages.get(bgId);
          if (cached) this.sessionMessages.set(bgId, cached.map(applySkill));
        }
        break;
      }
    }

    this.lastEventType = event.type;
  }
}
