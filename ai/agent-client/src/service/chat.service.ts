import 'reflect-metadata';
import { Service, observable, action, computed } from '@svton/service';
import { logger } from '@svton/agent-core';
import type { AgentConfig, AgentRuntime, PublicRuntimeEvent, ReasoningEffort } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress } from '../types';
import { InputHistoryStore } from './chat-input-history';
import { ApprovalQueue } from './chat-approval-queue';
import { ChatEventHandler } from './chat-event-handler';
import { planEditMessage, planRetry, planRetryFromMessage, type MessageEditPlan } from './chat-commands';
import { captureRuntimeMessageIndex, rollbackRuntimeForMessage } from './chat-runtime-history.service';
import { recreateRuntime } from './chat-runtime-lifecycle';
import { ChatSessionRuntimeService } from './chat-session-runtime.service';
import { ChatRunOwnershipService } from './chat-run-ownership.service';
import { prepareLoadedMessages, type LoadMessagesOptions } from './chat-message-loader.service';
import { abortStreaming, forceMessagesForSave, messagesForSave, updateToolCallStatusEverywhere, type MessageStoreHost } from './chat-message-store';
import { runAssistantTurn, finalizeStreamEnd } from './chat-stream-runner';
export type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress };
@Service()
export class ChatService implements MessageStoreHost {
  @observable() messages: DisplayMessage[] = [];
  @observable() status: ChatStatus = 'idle';
  @observable() currentModel = '';
  @observable() lastUsage: import('@earendil-works/pi-ai').Usage | null = null;
  @observable() activePlan: PlanProgress | null = null;
  @observable() activeSessionId: string | null = null;
  @observable() backgroundSessionId: string | null = null;
  @observable() runtimeSessionId: string | null = null;
  @observable() inputHistory: string[] = [];
  @observable() pendingApprovalVersion = 0;
  private runtime: AgentRuntime | null = null;
  private runtimeConfig: AgentConfig | null = null;
  private runtimeKey: string | undefined = undefined;
  private platform: IPlatform | null = null;
  private messageCounter = 0;
  private readonly sessionRuntime = new ChatSessionRuntimeService();
  private readonly runOwnership = new ChatRunOwnershipService();
  private readonly approvals = new ApprovalQueue(() => { this.pendingApprovalVersion += 1; });
  readonly sessionMessages = new Map<string, DisplayMessage[]>();
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
  @computed() get canSend(): boolean {
    return !this.isStreaming && !this.runOwnership.isProcessing && (!this.backgroundSessionId || this.backgroundSessionId === this.activeSessionId)
      && (!this.activeSessionId || this.runtimeSessionId === this.activeSessionId);
  }
  @computed() get hasPendingApprovals(): boolean { return this.approvals.size > 0; }
  getPendingToolCalls(): DisplayToolCall[] { return this.approvals.toDisplay(); }
  isSessionStreaming(sessionId: string): boolean { return this.backgroundSessionId === sessionId; }
  bumpPendingApprovals(): void { this.approvals.bump(); }
  handleEvent(event: PublicRuntimeEvent, assistantMsgId: string): void { this.handler.handle(event, assistantMsgId, this); }
  updateToolCallStatus(callId: string, status: DisplayToolCall['status'], metadata?: Record<string, unknown>): void {
    updateToolCallStatusEverywhere(this, callId, status, metadata);
  }
  handleStreamEnd(assistantMsgId: string, updates: Partial<DisplayMessage>): void {
    finalizeStreamEnd(this, assistantMsgId, updates, (id) => { this.sessionRuntime.releaseBackgroundRuntime(); this.onBackgroundStreamEnd?.(id); }, this.runOwnership.assistantMessageId);
  }
  get pendingToolCalls(): ApprovalQueue { return this.approvals; }
  @action()
  async init(platform: IPlatform, config: AgentConfig, runtimeKey?: string): Promise<void> {
    const sameRuntime = runtimeKey ? this.runtimeKey === runtimeKey : this.runtimeConfig === config;
    if (this.runtime && sameRuntime) return;
    this.platform = platform;
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
    this.runtimeSessionId = snapshotApplied ? this.activeSessionId : null;
    this.currentModel = config.model;
    this.runtimeConfig = config;
    this.runtimeKey = runtimeKey;
    if (this.messages.length === 0 && !snapshotApplied) this.messages = [];
    this.status = 'idle';
    this.lastUsage = null;
  }
  @action()
  async sendMessage(content: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    if (!this.runtime || !this.canSend) return;
    logger.info('Chat', 'Sending message', { length: content.length, hasImages: !!images?.length });
    this.history.record(content);
    const userMsg = this.createDisplayMessage('user', content);
    userMsg.runtimeMessageIndex = captureRuntimeMessageIndex(this.runtime);
    if (images && images.length > 0) userMsg.images = images;
    this.messages = [...this.messages, userMsg];
    await this.runAssistant(content, images);
  }
  @action()
  async retry(): Promise<void> { await this.runMessageEdit(planRetry(this.messages)); }
  @action()
  async retryFromMessage(messageId: string): Promise<void> { await this.runMessageEdit(planRetryFromMessage(this.messages, messageId)); }
  @action()
  async editMessage(messageId: string, newContent: string): Promise<void> { await this.runMessageEdit(planEditMessage(this.messages, messageId, newContent)); }
  private async runMessageEdit(plan: MessageEditPlan | null): Promise<void> {
    if (!this.runtime || !this.canSend || !plan) return;
    const messages = rollbackRuntimeForMessage(this.runtime, this.messages, plan);
    if (!messages) return;
    this.messages = messages;
    await this.runAssistant(plan.prompt, plan.images);
  }
  @action()
  approveToolCall(callId: string): void {
    this.approvals.resolve(callId, true);
    updateToolCallStatusEverywhere(this, callId, 'running');
    this.sessionRuntime.getStreamingRuntime(this.runtime, this.backgroundSessionId)?.approveToolCall(callId);
  }
  @action()
  rejectToolCall(callId: string): void {
    this.approvals.resolve(callId, false);
    updateToolCallStatusEverywhere(this, callId, 'error');
    this.sessionRuntime.getStreamingRuntime(this.runtime, this.backgroundSessionId)?.rejectToolCall(callId);
  }
  @action()
  abort(): void {
    this.sessionRuntime.getStreamingRuntime(this.runtime, this.backgroundSessionId)?.abort();
    for (const callId of this.approvals.keys()) updateToolCallStatusEverywhere(this, callId, 'error');
    this.approvals.clear();
    const bgId = abortStreaming(this);
    this.runOwnership.abortActive(() => { this.sessionRuntime.releaseBackgroundRuntime(); if (bgId && bgId !== this.activeSessionId) this.onBackgroundStreamEnd?.(bgId); });
  }
  @action()
  abortIfStreaming(): boolean {
    if (this.status !== 'running' && this.status !== 'waiting_approval') return false;
    this.abort();
    return true;
  }
  @action()
  bindSession(sessionId: string | null): void {
    this.sessionRuntime.invalidate();
    this.activeSessionId = sessionId;
    if (this.runtime && !this.backgroundSessionId && this.runtime.getMessages().length === 0) {
      this.runtimeSessionId = sessionId;
    }
  }
  setReasoningEffort(effort: ReasoningEffort | undefined): void { this.runtime?.setReasoningEffort(effort); }
  cacheSessionMessages(sessionId: string, messages: DisplayMessage[]): void { this.sessionMessages.set(sessionId, messages); }
  getCachedMessages(sessionId: string): DisplayMessage[] | undefined { return this.sessionMessages.get(sessionId); }
  getMessagesForSessionSave(sessionId: string): DisplayMessage[] { return messagesForSave(this, sessionId); }
  getMessagesForSave(): DisplayMessage[] { return messagesForSave(this); }
  forcePrepareForSave(): DisplayMessage[] { return forceMessagesForSave(this); }
  @action()
  async clearMessages(options?: LoadMessagesOptions): Promise<void> { this.runtime = await this.sessionRuntime.clear(this.runtime, { activeSessionId: this.activeSessionId, backgroundSessionId: this.backgroundSessionId, runtimeSessionId: this.runtimeSessionId, config: this.runtimeConfig, platform: this.platform }); this.applyLoaded([], options); this.history.recordFromMessages([]); this.runtimeSessionId = this.activeSessionId; }
  @action()
  async loadMessages(messages: DisplayMessage[], options?: LoadMessagesOptions): Promise<void> {
    const loaded = prepareLoadedMessages(messages, options);
    this.applyLoaded(loaded, options);
    this.history.recordFromMessages(loaded);
    await this.restoreActiveRuntime(loaded);
  }
  private applyLoaded(messages: DisplayMessage[], options?: LoadMessagesOptions): void {
    this.messages = messages;
    this.status = 'idle';
    this.lastUsage = null;
    if (!options?.preservePendingToolCalls && this.approvals.size > 0) this.approvals.clear();
  }
  async syncRuntimeToActiveSession(): Promise<void> { await this.restoreActiveRuntime(this.messages); }
  private async restoreActiveRuntime(messages: DisplayMessage[]): Promise<void> {
    const sessionId = this.activeSessionId;
    if (this.backgroundSessionId) return;
    const restored = await this.sessionRuntime.restore(
      this.runtime, sessionId, messages,
      () => sessionId === this.activeSessionId && !this.backgroundSessionId,
    );
    if (!restored) return;
    this.messages = restored;
    this.history.recordFromMessages(restored);
    this.runtimeSessionId = sessionId;
  }
  private async runAssistant(userContent: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    if (!this.runtime) return;
    await runAssistantTurn(
      {
        runtime: this.runtime, handler: this.handler, store: this,
        ownership: this.runOwnership,
        onBackgroundStreamEnd: (id) => { this.sessionRuntime.releaseBackgroundRuntime(); this.onBackgroundStreamEnd?.(id); },
        createDisplayMessage: (role, content) => this.createDisplayMessage(role, content),
      },
      userContent, images,
    );
  }
  private createDisplayMessage(role: 'user' | 'assistant' | 'system', content: string): DisplayMessage {
    return { id: `msg_${++this.messageCounter}`, role, content, toolCalls: [], timestamp: Date.now() };
  }
}
