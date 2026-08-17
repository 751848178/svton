import type { SvtonAgentRuntime } from '@svton/agent-core';
import type { DisplayMessage } from '../types';
import type { ChatApprovalController } from './chat-approval-controller';
import type { InputHistoryStore } from './chat-input-history';
import { prepareLoadedMessages, type LoadMessagesOptions } from './chat-message-loader.service';
import type { MessageStoreHost } from './chat-message-store';
import type { ChatRunOwnershipService } from './chat-run-ownership.service';
import type { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import { ChatSessionRuntimeService } from './chat-session-runtime.service';
import type { ChatSessionProjectionService } from './chat-session-projection.service';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { SessionRunState } from './chat-run.types';

interface MessageLifecycleBindings {
  host: MessageStoreHost;
  owner: () => string | null;
  runtimes: ChatRuntimeRegistryService;
  ownership: ChatRunOwnershipService;
  approvals: ChatApprovalController;
  projections: ChatSessionProjectionService;
  history: InputHistoryStore;
  setRuntime: (runtime: SvtonAgentRuntime, sessionId: string | null) => void;
  syncSelected: () => void;
  runs: ChatRunCoordinatorService;
  persistRecoveredRun?: (state: SessionRunState) => Promise<void>;
}

/** Loads, clears and checkpoint-restores only the selected session runtime. */
export class ChatMessageLifecycleService {
  private readonly restores = new ChatSessionRuntimeService();

  constructor(private readonly bindings: MessageLifecycleBindings) {}

  invalidate(sessionId: string | null): void {
    this.restores.invalidate(sessionId);
  }

  async clear(options?: LoadMessagesOptions): Promise<void> {
    const owner = this.bindings.owner();
    if (this.bindings.ownership.isProcessing(owner)) this.bindings.runtimes.delete(owner);
    const runtime = await this.bindings.runtimes.ensureCurrent(owner);
    runtime.reset();
    this.apply([], options);
    this.bindings.history.recordFromMessages([]);
    this.bindings.setRuntime(runtime, owner);
  }

  async load(messages: DisplayMessage[], options?: LoadMessagesOptions): Promise<void> {
    const loaded = prepareLoadedMessages(messages, options);
    this.apply(loaded, options);
    this.bindings.history.recordFromMessages(loaded);
    await this.restore(loaded);
  }

  async sync(): Promise<void> {
    await this.restore(this.bindings.host.messages);
  }

  private apply(messages: DisplayMessage[], options?: LoadMessagesOptions): void {
    const owner = this.bindings.owner();
    this.bindings.host.messages = messages;
    this.bindings.projections.captureLoaded(owner, messages);
    if (!options?.preserveLiveApprovals && !options?.preservePendingToolCalls) {
      this.bindings.approvals.interruptSession(owner);
    }
    this.bindings.syncSelected();
  }

  private async restore(messages: DisplayMessage[]): Promise<void> {
    const owner = this.bindings.owner();
    if (this.bindings.ownership.isProcessing(owner)) return;
    const recovery = await this.bindings.runs.recover(owner);
    if (recovery.state?.sessionId && recovery.state.completedAt !== undefined) {
      await this.bindings.persistRecoveredRun?.(recovery.state);
    }
    const runtime = await this.bindings.runtimes.ensureCurrent(owner);
    const restored = await this.restores.restore(
      runtime,
      owner,
      messages,
      () => owner === this.bindings.owner() && !this.bindings.ownership.isProcessing(owner),
      recovery,
    );
    if (!restored) return;
    this.bindings.host.messages = restored;
    this.bindings.projections.captureLoaded(owner, restored);
    this.bindings.history.recordFromMessages(restored);
    this.bindings.setRuntime(runtime, owner);
  }
}
