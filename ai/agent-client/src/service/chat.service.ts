import 'reflect-metadata';
import { Service, observable, action, computed } from '@svton/service';
import { canonicalSessionId, type AgentConfig, type PermissionMode, type PublicRuntimeEvent, type ReasoningEffort, type SvtonAgentRuntime, type ToolApprovalDecision, type ToolApprovalRequest, type UserInputAnswers } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress } from '../types';
import { InputHistoryStore } from './chat-input-history';
import { ApprovalQueue } from './chat-approval-queue';
import { planEditMessage, planRetry, planRetryFromMessage, type MessageEditPlan } from './chat-commands';
import { ChatRunOwnershipService } from './chat-run-ownership.service';
import type { LoadMessagesOptions } from './chat-message-loader.service';
import { abortStreaming, forceMessagesForSave, forceMessagesForSessionSave, messagesForSave, type MessageStoreHost } from './chat-message-store';
import { finalizeStreamEnd } from './chat-stream-runner';
import { ChatUserInputStore, type PendingUserInputRequest } from './chat-user-input-store';
import { ChatApprovalController } from './chat-approval-controller';
import { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import { resolveCompatibilityEventAddress } from './chat-event-run-address';
import type { SessionRunState } from './chat-run.types';
import { runChatMessageEdit } from './chat-message-edit-runner';
import { createChatEventHandler } from './chat-event-handler.factory';
import { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import { ChatSessionProjectionService } from './chat-session-projection.service';
import { ChatSendCoordinatorService } from './chat-send-coordinator.service';
import type { ChatPreparedInput } from './chat-prepared-input.types';
import { ChatMessageLifecycleService } from './chat-message-lifecycle.service';
import { updateAddressedToolCallStatus } from './chat-message-owner-projection';
import { ChatRuntimeInitializationService } from './chat-runtime-initialization.service';
import type { ModelKey } from '../model-switch/model-switch.types';
import { ChatRuntimeSettingsService } from './chat-runtime-settings.service';
import { projectSelectedRuntime } from './chat-selected-runtime-projection';
export type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress };
@Service()
export class ChatService implements MessageStoreHost {
  @observable() messages: DisplayMessage[] = [];
  @observable() status: ChatStatus = 'idle';
  @observable() currentModel = '';
  @observable() currentModelKey: ModelKey | null = null;
  @observable() currentReasoningEffort: ReasoningEffort | undefined = undefined;
  @observable() currentPermissionMode: PermissionMode | undefined = undefined;
  @observable() lastUsage: import('@earendil-works/pi-ai').Usage | null = null;
  @observable() activePlan: PlanProgress | null = null;
  @observable() activeSessionId: string | null = null;
  @observable() backgroundSessionId: string | null = null;
  @observable() runtimeSessionId: string | null = null;
  @observable() inputHistory: string[] = [];
  @observable() pendingApprovalVersion = 0;
  @observable() pendingUserInputVersion = 0;
  @observable() runStateVersion = 0;
  readonly sessionUsage: Map<string | null, import('@earendil-works/pi-ai').Usage | null>;
  readonly sessionPlans: Map<string | null, PlanProgress | null>;
  private runtime: SvtonAgentRuntime | null = null; private messageCounter = 0;
  private readonly runtimeRegistry = new ChatRuntimeRegistryService();
  private readonly runOwnership = new ChatRunOwnershipService();
  private readonly runs = new ChatRunCoordinatorService(() => this.publishRunState());
  private readonly projections = new ChatSessionProjectionService();
  private readonly approvalController = new ChatApprovalController(this, (sessionId) => this.runtimeRegistry.get(sessionId), () => { this.pendingApprovalVersion += 1; });
  private readonly approvals = this.approvalController.queue;
  private readonly userInputs = new ChatUserInputStore(() => { this.pendingUserInputVersion += 1; });
  readonly sessionMessages = new Map<string, DisplayMessage[]>();
  onBackgroundStreamEnd: ((sessionId: string) => void) | null = null; onRunDisplayPersist: import('./chat-stream-runner').StreamRunnerDeps['persistRunDisplay'];
  private readonly history = new InputHistoryStore();
  private readonly handler = createChatEventHandler(this.approvals, this.userInputs, this.approvalController, this.runs, (address) => {
    const runtime = address ? this.runtimeRegistry.get(address.sessionId) : null;
    return runtime
      ? (requestId, answers) => runtime.respondToUserInput(canonicalSessionId(address?.sessionId), requestId, answers)
      : undefined;
  }, (text, systemType) => this.createSystemMessage(text, systemType));
  private readonly sends = new ChatSendCoordinatorService({
    host: this, runtimes: this.runtimeRegistry, ownership: this.runOwnership,
    runs: this.runs, handler: this.handler,
    createMessage: (role, content) => this.createDisplayMessage(role, content),
    recordInput: (content) => this.history.record(content),
    notify: () => this.publishRunState(),
    onBackgroundEnd: () => this.onBackgroundStreamEnd,
    persistRunDisplay: () => this.onRunDisplayPersist,
  });
  private readonly messageLifecycle = new ChatMessageLifecycleService({
    host: this, owner: () => this.activeSessionId,
    runtimes: this.runtimeRegistry, ownership: this.runOwnership,
    approvals: this.approvalController, projections: this.projections, history: this.history, runs: this.runs,
    setRuntime: (runtime, sessionId) => { this.runtime = runtime; this.runtimeSessionId = sessionId; },
    syncSelected: () => this.syncSelectedProjection(),
    persistRecoveredRun: async (state) => { if (state.sessionId) await this.onRunDisplayPersist?.(state.sessionId, state.phase, state); },
  });
  private readonly initialization = new ChatRuntimeInitializationService({
    runtimes: this.runtimeRegistry, ownership: this.runOwnership, history: this.history,
    owner: () => this.activeSessionId, inputHistory: () => this.inputHistory,
    publishInputHistory: (items) => { this.inputHistory = items; },
    interruptOwner: (owner) => { this.approvalController.interruptSession(owner); this.userInputs.interruptSession(canonicalSessionId(owner)); },
    publishSelected: () => this.syncSelectedProjection(),
  });
  readonly runtimeSettings = new ChatRuntimeSettingsService(
    this.runtimeRegistry, this.runOwnership, this.runs, this.approvals, this.userInputs,
    () => this.activeSessionId, () => this.syncSelectedProjection());
  constructor() { this.sessionUsage = this.projections.usage; this.sessionPlans = this.projections.plans; }
  @computed() get isStreaming(): boolean { return this.runs.state(this.activeSessionId) ? this.runs.isStreaming(this.activeSessionId) : this.status === 'running' || this.status === 'waiting_approval'; }
  @computed() get canSend(): boolean { return this.initialization.ready && !this.isStreaming && !this.runOwnership.isProcessing(this.activeSessionId) && !this.sends.isStarting(this.activeSessionId) && !this.runtimeSettings.isPending(this.activeSessionId); }
  @computed() get hasPendingApprovals(): boolean { return this.approvals.size > 0; }
  hasPendingApprovalsForSession(sessionId: string | null): boolean { return this.approvals.hasSession(sessionId); }
  getPendingApproval(): ToolApprovalRequest | null { return this.approvals.head(this.activeSessionId); }
  getPendingToolCalls(): DisplayToolCall[] { return this.approvals.toDisplay(this.activeSessionId); }
  getPendingUserInput(): PendingUserInputRequest | null { return this.userInputs.head(this.activeSessionId); }
  getSessionRunState(sessionId: string | null): SessionRunState | null { return this.runs.state(sessionId); }
  isSessionStreaming(sessionId: string): boolean { return this.runs.isStreaming(sessionId) || this.runOwnership.isProcessing(sessionId); }
  getRunningSessionIds(): string[] { return this.runOwnership.addresses().flatMap((address) => address.sessionId ? [address.sessionId] : []); } flushRunJournal(sessionId: string | null): Promise<void> { return this.runs.flush(sessionId); }
  bumpPendingApprovals(): void { this.approvals.bump(); }
  handleEvent(event: PublicRuntimeEvent, assistantMsgId: string): void { this.handler.handle(event, assistantMsgId, this, resolveCompatibilityEventAddress(event, this.runs, this.runOwnership.address(this.activeSessionId), this.activeSessionId, this.backgroundSessionId)); }
  updateToolCallStatus(callId: string, status: DisplayToolCall['status'], metadata?: Record<string, unknown>): void { updateAddressedToolCallStatus(this, callId, status, metadata, this.activeSessionId); }
  handleStreamEnd(assistantMsgId: string, updates: Partial<DisplayMessage>): void { const address = this.runOwnership.address(this.activeSessionId) ?? this.runs.address(this.activeSessionId) ?? this.runs.createAddress(this.activeSessionId); finalizeStreamEnd(this, address, assistantMsgId, updates, this.onBackgroundStreamEnd, this.runOwnership.assistantMessageId(address.sessionId)); }
  get pendingToolCalls(): ApprovalQueue { return this.approvals; }
  @action() async init(platform: IPlatform, config: AgentConfig, runtimeKey?: string, modelKey: ModelKey | null = null): Promise<void> { this.runs.attachStorage(platform.storage); await this.initialization.init(platform, config, runtimeKey, modelKey); }
  @action()
  async sendMessage(content: string, images?: Array<{ data: string; mimeType?: string }>): Promise<void> {
    if (!this.canSend) return;
    await this.sends.send(this.activeSessionId, {
      publicContent: content, runtimeContent: content, historyContent: content, images,
    });
  }
  @action()
  acceptPreparedMessage(input: ChatPreparedInput): boolean {
    if (!this.canSend) return false;
    void this.sends.send(this.activeSessionId, input);
    return true;
  }
  @action() async retry(): Promise<void> { await this.runMessageEdit(planRetry(this.messages)); }
  @action() async retryFromMessage(messageId: string): Promise<void> { await this.runMessageEdit(planRetryFromMessage(this.messages, messageId)); }
  @action() async editMessage(messageId: string, newContent: string): Promise<void> { await this.runMessageEdit(planEditMessage(this.messages, messageId, newContent)); }
  private async runMessageEdit(plan: MessageEditPlan | null): Promise<void> {
    const owner = this.activeSessionId;
    const runtime = this.runtimeRegistry.get(owner);
    await runChatMessageEdit(this, runtime, plan, (prompt, images) => runtime
      ? this.sends.run(this.runs.createAddress(owner), runtime, prompt, images) : Promise.resolve());
  }
  @action() settleToolApproval(requestId: string, decision: ToolApprovalDecision): boolean {
    return this.approvalController.settleRequest(requestId, decision);
  }
  @action() approveToolCall(callId: string): void { this.approvalController.settleItem(callId, 'accept'); }
  @action() rejectToolCall(callId: string): void { this.approvalController.settleItem(callId, 'decline'); }
  @action()
  submitUserInput(requestId: string, answers: UserInputAnswers): boolean { return this.userInputs.submit(this.activeSessionId, requestId, answers); }
  @action()
  updateUserInputDraft(requestId: string, questionId: string, value: string): boolean { return this.userInputs.updateDraft(this.activeSessionId, requestId, questionId, value); }
  @action() abort(): void { this.abortSession(this.activeSessionId); }
  abortSession(ownerSessionId: string | null): boolean {
    const address = this.runOwnership.address(ownerSessionId) ?? this.runs.address(ownerSessionId);
    if (!address || !this.runs.isStreaming(ownerSessionId)) return false;
    const wasCreating = this.sends.isCreatingRuntime(ownerSessionId);
    if (wasCreating) this.runtimeRegistry.cancelPending(ownerSessionId);
    else this.runtimeRegistry.abort(ownerSessionId);
    this.userInputs.interruptSession(canonicalSessionId(ownerSessionId));
    this.approvalController.interruptSession(ownerSessionId);
    const backgroundId = abortStreaming(this, ownerSessionId);
    this.runs.interrupt(address);
    const interrupted = this.runs.state(ownerSessionId);
    if (ownerSessionId && interrupted) void this.onRunDisplayPersist?.(ownerSessionId, 'interrupted', interrupted);
    this.handler.resetSequenceState(address);
    if (wasCreating) {
      this.sends.cancel(ownerSessionId);
      this.runOwnership.discardSession(ownerSessionId);
      if (backgroundId) this.onBackgroundStreamEnd?.(backgroundId);
    } else this.runOwnership.abortSession(ownerSessionId, () => {
        if (backgroundId) this.onBackgroundStreamEnd?.(backgroundId);
      });
    this.publishRunState();
    return true;
  }
  @action()
  abortIfStreaming(): boolean {
    if (!this.isStreaming) return false;
    this.abort();
    return true;
  }
  @action()
  bindSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
    this.runtime = this.runtimeRegistry.get(sessionId);
    this.syncSelectedProjection();
  }
  cacheSessionMessages(sessionId: string, messages: DisplayMessage[]): void { this.sessionMessages.set(sessionId, messages); this.projections.captureLoaded(sessionId, messages); }
  getCachedMessages(sessionId: string): DisplayMessage[] | undefined { return this.sessionMessages.get(sessionId); }
  getMessagesForSessionSave(sessionId: string): DisplayMessage[] { return messagesForSave(this, sessionId); }
  forcePrepareForSessionSave(sessionId: string): DisplayMessage[] { return forceMessagesForSessionSave(this, sessionId); }
  getMessagesForSave(): DisplayMessage[] { return messagesForSave(this); }
  forcePrepareForSave(): DisplayMessage[] { return forceMessagesForSave(this); }
  async deleteSessionState(sessionId: string): Promise<void> {
    this.sends.cancel(sessionId);
    this.abortSession(sessionId);
    this.runtimeRegistry.delete(sessionId);
    this.runOwnership.discardSession(sessionId);
    this.approvalController.interruptSession(sessionId);
    this.userInputs.interruptSession(canonicalSessionId(sessionId));
    this.messageLifecycle.invalidate(sessionId);
    this.runs.clear(sessionId);
    this.sessionMessages.delete(sessionId);
    this.projections.delete(sessionId);
    if (this.activeSessionId === sessionId) this.messages = [];
    this.publishRunState(); await this.runs.deleteDurableState(sessionId);
  }
  @action()
  async clearMessages(options?: LoadMessagesOptions): Promise<void> { await this.messageLifecycle.clear(options); }
  @action()
  async loadMessages(messages: DisplayMessage[], options?: LoadMessagesOptions): Promise<void> { await this.messageLifecycle.load(messages, options); }
  async syncRuntimeToActiveSession(): Promise<void> { await this.messageLifecycle.sync(); }
  private publishRunState(): void { this.runStateVersion += 1; this.syncSelectedProjection(); }
  private syncSelectedProjection(): void { Object.assign(this, projectSelectedRuntime(this.activeSessionId, this.runtimeRegistry, this.projections, this.runs)); }
  private createSystemMessage(text: string, systemType: string): DisplayMessage { const msg = this.createDisplayMessage('system', text); msg.systemType = systemType as DisplayMessage['systemType']; return msg; }
  private createDisplayMessage(role: 'user' | 'assistant' | 'system', content: string): DisplayMessage { return { id: `msg_${++this.messageCounter}`, role, content, toolCalls: [], timestamp: Date.now() }; }
}
