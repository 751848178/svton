import 'reflect-metadata';
import { Service, observable, action, computed } from '@svton/service';
import { logger } from '@svton/agent-core';
import type { AgentConfig, AgentEvent, AgentRuntime, ReasoningEffort, TokenUsage } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress } from '../types';
import { InputHistoryStore } from './chat-input-history';
import { ApprovalQueue } from './chat-approval-queue';
import { ChatEventHandler } from './chat-event-handler';
import { planEditMessage, planRetry, planRetryFromMessage } from './chat-commands';
import { restoreMessagesIntoRuntime } from './chat-runtime-bridge';
import { chatToDisplayMessages } from './chat-to-display.utils';
import { recreateRuntime } from './chat-runtime-lifecycle';
import {
  abortStreaming,
  forceMessagesForSave,
  messagesForSave,
  updateToolCallStatusEverywhere,
  type MessageStoreHost,
} from './chat-message-store';
import { runAssistantTurn, finalizeStreamEnd } from './chat-stream-runner';
import { finalizeStalePendingApprovals } from './chat-message-tool-status.utils';

export type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress };

/** ChatService — composition root for the chat lifecycle. Owns the observable state Web/Desktop subscribe to; implements MessageStoreHost so the stateless event handler mutates the live observable slice. Public API stable; internals split across chat-event-handler/-input-history/-approval-queue/-runtime-bridge/-runtime-lifecycle/-stream-runner/-commands (PI007). */
@Service()
export class ChatService implements MessageStoreHost {
  @observable() messages: DisplayMessage[] = [];
  @observable() status: ChatStatus = 'idle';
  @observable() currentModel = '';
  @observable() lastUsage: TokenUsage | null = null;
  @observable() activePlan: PlanProgress | null = null;
  @observable() activeSessionId: string | null = null;
  @observable() inputHistory: string[] = [];
  @observable() pendingApprovalVersion = 0;

  private runtime: AgentRuntime | null = null;
  private runtimeConfig: AgentConfig | null = null;
  private runtimeKey: string | undefined = undefined;
  private platform: IPlatform | null = null;
  private messageCounter = 0;
  private readonly approvals = new ApprovalQueue(() => { this.pendingApprovalVersion += 1; });
  readonly sessionMessages = new Map<string, DisplayMessage[]>();
  backgroundSessionId: string | null = null;
  private readonly streamingAssistantMsgId = { current: null as string | null };
  onBackgroundStreamEnd: ((sessionId: string) => void) | null = null;
  private readonly history = new InputHistoryStore();
  private readonly handler = new ChatEventHandler({
    approvals: this.approvals,
    createSystemMessage: (text, systemType) => {
      const msg = this.createDisplayMessage('system', text);
      msg.systemType = systemType as DisplayMessage['systemType'];
      return msg;
    },
  });
  @computed() get isStreaming(): boolean {
    return this.status === 'running' || this.status === 'waiting_approval';
  }
  @computed() get hasPendingApprovals(): boolean { return this.approvals.size > 0; }
  getPendingToolCalls(): DisplayToolCall[] { return this.approvals.toDisplay(); }
  isSessionStreaming(sessionId: string): boolean { return this.backgroundSessionId === sessionId; }
  /** Bump the observable pending-approval version (forces hook re-reads). */
  bumpPendingApprovals(): void { this.approvals.bump(); }
  /** Dispatch a single AgentEvent to the display projection (test/advanced seam). */
  handleEvent(event: AgentEvent, assistantMsgId: string): void { this.handler.handle(event, assistantMsgId, this); }
  /** Update a tool call's status across active + background sessions (test seam). */
  updateToolCallStatus(callId: string, status: DisplayToolCall['status'], metadata?: Record<string, unknown>): void {
    updateToolCallStatusEverywhere(this, callId, status, metadata);
  }
  /** Finalize a streaming assistant message (test/advanced seam). */
  handleStreamEnd(assistantMsgId: string, updates: Partial<DisplayMessage>): void {
    finalizeStreamEnd(this, assistantMsgId, updates, this.onBackgroundStreamEnd, this.streamingAssistantMsgId);
  }
  /** Pending-approval queue (tests/advanced consumers seed/clear directly). */
  get pendingToolCalls(): ApprovalQueue { return this.approvals; }
  @action()
  async init(platform: IPlatform, config: AgentConfig, runtimeKey?: string): Promise<void> {
    const sameRuntime = runtimeKey ? this.runtimeKey === runtimeKey : this.runtimeConfig === config;
    if (this.runtime && sameRuntime) return;
    this.platform = platform;
    // PI007 3-list fix: snapshot canonical runtime truth before recreating (one-way runtime→runtime).
    const { runtime, snapshotApplied } = await recreateRuntime(
      {
        platform, config, approvals: this.approvals, host: this,
        attachHistory: () => this.history.attach({
          platform, get: () => this.inputHistory, publish: (items) => { this.inputHistory = items; },
        }),
      },
      this.runtime,
    );
    this.runtime = runtime;
    this.currentModel = config.model;
    this.runtimeConfig = config;
    this.runtimeKey = runtimeKey;
    if (this.messages.length === 0 && !snapshotApplied) this.messages = [];
    this.status = 'idle';
    this.lastUsage = null;
  }

  @action()
  async sendMessage(content: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    if (!this.runtime || this.isStreaming) return;
    logger.info('Chat', 'Sending message', { length: content.length, hasImages: !!images?.length });
    this.history.record(content);
    const userMsg = this.createDisplayMessage('user', content);
    if (images && images.length > 0) userMsg.images = images;
    this.messages = [...this.messages, userMsg];
    await this.runAssistant(content, images);
  }

  @action()
  async retry(): Promise<void> { await this.runMessageEdit(planRetry(this.messages)); }
  @action()
  async retryFromMessage(messageId: string): Promise<void> {
    await this.runMessageEdit(planRetryFromMessage(this.messages, messageId));
  }
  @action()
  async editMessage(messageId: string, newContent: string): Promise<void> {
    await this.runMessageEdit(planEditMessage(this.messages, messageId, newContent));
  }
  /** Shared retry/edit runner: apply the planned message mutation, then re-run. */
  private async runMessageEdit(plan: { messages: DisplayMessage[]; prompt: string } | null): Promise<void> {
    if (!this.runtime || this.isStreaming || !plan) return;
    this.messages = plan.messages;
    await this.runAssistant(plan.prompt);
  }

  @action()
  approveToolCall(callId: string): void {
    this.approvals.resolve(callId, true);
    updateToolCallStatusEverywhere(this, callId, 'running');
    this.runtime?.approveToolCall(callId);
  }
  @action()
  rejectToolCall(callId: string): void {
    this.approvals.resolve(callId, false);
    updateToolCallStatusEverywhere(this, callId, 'error');
    this.runtime?.rejectToolCall(callId);
  }

  @action()
  abort(): void {
    this.runtime?.abort();
    for (const callId of this.approvals.keys()) updateToolCallStatusEverywhere(this, callId, 'error');
    this.approvals.clear();
    const bgId = abortStreaming(this);
    this.streamingAssistantMsgId.current = null;
    if (bgId && bgId !== this.activeSessionId) this.onBackgroundStreamEnd?.(bgId);
  }

  @action()
  abortIfStreaming(): boolean {
    if (this.status !== 'running' && this.status !== 'waiting_approval') return false;
    this.abort();
    return true;
  }

  @action()
  bindSession(sessionId: string | null): void { this.activeSessionId = sessionId; }
  setReasoningEffort(effort: ReasoningEffort | undefined): void { this.runtime?.setReasoningEffort(effort); }
  cacheSessionMessages(sessionId: string, messages: DisplayMessage[]): void { this.sessionMessages.set(sessionId, messages); }
  getCachedMessages(sessionId: string): DisplayMessage[] | undefined { return this.sessionMessages.get(sessionId); }
  getMessagesForSessionSave(sessionId: string): DisplayMessage[] { return messagesForSave(this, sessionId); }
  getMessagesForSave(): DisplayMessage[] { return messagesForSave(this); }
  forcePrepareForSave(): DisplayMessage[] { return forceMessagesForSave(this); }

  @action()
  clearMessages(options?: { preservePendingToolCalls?: boolean }): void { this.applyLoaded([], options); }
  @action()
  loadMessages(messages: DisplayMessage[], options?: { preservePendingToolCalls?: boolean }): void {
    const loaded = options?.preservePendingToolCalls ? messages : finalizeStalePendingApprovals(messages);
    this.applyLoaded(loaded, options);
    this.history.recordFromMessages(loaded);
    if (this.runtime) {
      // When the checkpoint restores the runtime, re-derive the display list
      // from the runtime's canonical messages (the saved display list may be
      // empty/stale). Fire-and-forget; failures fall back to the loaded list.
      void restoreMessagesIntoRuntime(this.runtime, this.activeSessionId, loaded).then((restored) => {
        if (restored && this.activeSessionId) {
          const refreshed = chatToDisplayMessages(this.runtime!.getMessages());
          if (refreshed.length > 0) this.applyLoaded(refreshed, options);
        }
      });
    }
  }
  /** Apply a loaded message list + idle the status (shared by clear/load). */
  private applyLoaded(messages: DisplayMessage[], options?: { preservePendingToolCalls?: boolean }): void {
    this.messages = messages;
    this.status = 'idle';
    this.lastUsage = null;
    if (!options?.preservePendingToolCalls && this.approvals.size > 0) this.approvals.clear();
  }

  private async runAssistant(userContent: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    if (!this.runtime) return;
    await runAssistantTurn(
      {
        runtime: this.runtime, handler: this.handler, store: this,
        streamingAssistantMsgId: this.streamingAssistantMsgId,
        onBackgroundStreamEnd: this.onBackgroundStreamEnd,
        createDisplayMessage: (role, content) => this.createDisplayMessage(role, content),
      },
      userContent, images,
    );
  }

  private createDisplayMessage(role: 'user' | 'assistant' | 'system', content: string): DisplayMessage {
    return { id: `msg_${++this.messageCounter}`, role, content, toolCalls: [], timestamp: Date.now() };
  }
}
