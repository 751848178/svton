import { createChatRunId } from './chat-run-id';
import { ChatRunRegistryService } from './chat-run-registry.service';
import {
  selectCompatibilityStatus,
  selectComposerState,
  selectPendingDecision,
} from './chat-run-selectors';
import type { ChatStatus } from '../types';
import type { IStorage } from '@svton/agent-platform';
import { ChatRunJournalService } from './chat-run-journal.service';
import type { ChatRunRecovery } from './chat-run-journal.types';
import { TERMINAL_RUN_PHASES } from './chat-run.types';
import type {
  ChatRunAddress,
  ChatRunError,
  ChatRunTransition,
  SessionRunState,
} from './chat-run.types';
import { deleteDurableChatState } from './chat-durable-session-cleanup';

/** Facade for addressed lifecycle writes and selected-session compatibility reads. */
export class ChatRunCoordinatorService {
  private readonly registry: ChatRunRegistryService;
  private readonly journal = new ChatRunJournalService();
  private readonly recovered = new Set<string>();
  private readonly recoveryPromises = new Map<string, Promise<ChatRunRecovery>>();
  private readonly recoveryEpochs = new Map<string, number>();
  private storage: IStorage | null = null;

  constructor(
    private readonly notify: () => void = () => {},
    private readonly createId: () => string = createChatRunId,
  ) {
    this.registry = new ChatRunRegistryService();
  }

  attachStorage(storage: IStorage): void {
    if (this.storage === storage) return;
    this.storage = storage;
    this.journal.configure(storage);
    this.recovered.clear();
    this.recoveryPromises.clear();
    this.recoveryEpochs.clear();
  }

  createAddress(sessionId: string | null): ChatRunAddress {
    return { sessionId, runId: this.createId() };
  }
  start(address: ChatRunAddress, at = Date.now()): SessionRunState | null {
    return this.commit({ type: 'start', ...address, at });
  }

  ensureAddress(sessionId: string | null): ChatRunAddress {
    const existing = this.address(sessionId);
    if (existing) return existing;
    const address = this.createAddress(sessionId);
    this.start(address);
    return address;
  }

  transition(transition: ChatRunTransition): SessionRunState | null {
    return this.commit(transition);
  }
  requestApproval(address: ChatRunAddress, requestId: string): void {
    this.transition({ type: 'approvalRequested', ...address, requestId });
  }

  settleApproval(address: ChatRunAddress, requestId: string): void {
    this.transition({ type: 'approvalSettled', ...address, requestId });
  }
  requestUserInput(address: ChatRunAddress, requestId: string): void {
    this.transition({ type: 'userInputRequested', ...address, requestId });
  }

  settleUserInput(address: ChatRunAddress, requestId: string): void {
    this.transition({ type: 'userInputSettled', ...address, requestId });
  }
  finalizing(address: ChatRunAddress): void {
    this.transition({ type: 'finalizing', ...address });
  }

  complete(address: ChatRunAddress, at = Date.now()): void {
    this.transition({ type: 'completed', ...address, at });
  }
  fail(address: ChatRunAddress, error: ChatRunError, at = Date.now()): void {
    this.transition({ type: 'failed', ...address, error, at });
  }

  interrupt(address: ChatRunAddress, at = Date.now()): void {
    this.transition({ type: 'interrupted', ...address, at });
  }
  settle(
    transition: Extract<ChatRunTransition, { type: 'completed' | 'failed' | 'interrupted' }>,
    publishDisplay: () => void,
  ): SessionRunState | null {
    const previous = this.registry.get(transition.sessionId);
    const next = this.registry.transition(transition);
    if (next === previous) return next;
    if (next) void this.journal.persist(next);
    publishDisplay();
    this.notify();
    return next;
  }

  async recover(sessionId: string | null, at = Date.now()): Promise<ChatRunRecovery> {
    if (!sessionId || this.recovered.has(sessionId)) {
      return { state: this.state(sessionId), recoveredAsInterrupted: false };
    }
    const pending = this.recoveryPromises.get(sessionId);
    if (pending) return pending;
    const recovery = this.recoverOnce(sessionId, at, this.recoveryEpoch(sessionId));
    this.recoveryPromises.set(sessionId, recovery);
    try {
      return await recovery;
    } finally {
      if (this.recoveryPromises.get(sessionId) === recovery) {
        this.recoveryPromises.delete(sessionId);
      }
    }
  }

  private async recoverOnce(
    sessionId: string,
    at: number,
    epoch: number,
  ): Promise<ChatRunRecovery> {
    const record = await this.journal.load(sessionId);
    if (this.recoveryEpoch(sessionId) !== epoch) {
      return { state: this.state(sessionId), recoveredAsInterrupted: false };
    }
    this.recovered.add(sessionId);
    if (!record) return { state: this.state(sessionId), recoveredAsInterrupted: false };
    this.registry.hydrate(record.state);
    if (TERMINAL_RUN_PHASES.has(record.state.phase)) {
      this.notify();
      return { state: record.state, recoveredAsInterrupted: false };
    }
    const recovered = this.commit({
      type: 'interrupted', sessionId, runId: record.state.runId, at,
    });
    await this.journal.flush(sessionId);
    return { state: recovered, recoveredAsInterrupted: true };
  }

  flush(sessionId: string | null): Promise<void> {
    return sessionId ? this.journal.flush(sessionId) : Promise.resolve();
  }
  deleteDurableState(sessionId: string): Promise<void> {
    this.recovered.delete(sessionId);
    this.recoveryPromises.delete(sessionId);
    this.recoveryEpochs.set(sessionId, this.recoveryEpoch(sessionId) + 1);
    return deleteDurableChatState(this.storage, this.journal, sessionId);
  }

  state(sessionId: string | null): SessionRunState | null {
    return this.registry.get(sessionId);
  }

  clear(sessionId: string | null): boolean {
    return this.registry.clear(sessionId);
  }

  address(sessionId: string | null): ChatRunAddress | null {
    return this.registry.currentAddress(sessionId);
  }

  status(sessionId: string | null): ChatStatus {
    return selectCompatibilityStatus(this.state(sessionId));
  }

  composer(sessionId: string | null) {
    return selectComposerState(this.state(sessionId));
  }

  pendingDecision(sessionId: string | null) {
    return selectPendingDecision(this.state(sessionId));
  }

  isStreaming(sessionId: string | null): boolean {
    return this.composer(sessionId).isStreaming;
  }

  acceptsEvents(address: ChatRunAddress): boolean {
    const state = this.state(address.sessionId);
    return state?.runId === address.runId && this.isStreaming(address.sessionId);
  }

  private commit(transition: ChatRunTransition): SessionRunState | null {
    const previous = this.registry.get(transition.sessionId);
    const next = this.registry.transition(transition);
    if (next === previous) return next;
    if (next) void this.journal.persist(next);
    this.notify();
    return next;
  }

  private recoveryEpoch(sessionId: string): number {
    return this.recoveryEpochs.get(sessionId) ?? 0;
  }
}
