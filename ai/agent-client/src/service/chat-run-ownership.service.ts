import type { ChatRunAddress } from './chat-run.types';

interface ActiveChatRun {
  generation: number;
  address: ChatRunAddress;
  assistantMessageId: string;
  acceptsEvents: boolean;
  onAbortedSettled: (() => void) | null;
}

export interface ChatRunLease {
  readonly address: ChatRunAddress;
  acceptsEvents: () => boolean;
  release: () => boolean;
}

/** Keeps one runtime run per session owned until its generator fully settles. */
export class ChatRunOwnershipService {
  private generation = 0;
  private readonly active = new Map<string | null, ActiveChatRun>();

  isProcessing(sessionId: string | null): boolean {
    return this.active.has(sessionId);
  }

  address(sessionId: string | null): ChatRunAddress | null {
    const run = this.active.get(sessionId);
    return run ? { ...run.address } : null;
  }

  addresses(): ChatRunAddress[] {
    return [...this.active.values()].map((run) => ({ ...run.address }));
  }

  assistantMessageId(sessionId: string | null): string | null {
    return this.active.get(sessionId)?.assistantMessageId ?? null;
  }

  begin(address: ChatRunAddress, assistantMessageId: string): ChatRunLease | null {
    if (this.active.has(address.sessionId)) return null;
    const run: ActiveChatRun = {
      generation: ++this.generation,
      address,
      assistantMessageId,
      acceptsEvents: true,
      onAbortedSettled: null,
    };
    this.active.set(address.sessionId, run);
    return {
      address,
      acceptsEvents: () => this.active.get(address.sessionId) === run && run.acceptsEvents,
      release: () => this.release(run),
    };
  }

  abortSession(sessionId: string | null, onIdle?: () => void): void {
    const run = this.active.get(sessionId);
    if (run) {
      run.acceptsEvents = false;
      run.onAbortedSettled ??= onIdle ?? null;
      return;
    }
    onIdle?.();
  }

  discardSession(sessionId: string | null): boolean {
    const run = this.active.get(sessionId);
    if (!run) return false;
    run.acceptsEvents = false;
    this.active.delete(sessionId);
    return true;
  }

  private release(run: ActiveChatRun): boolean {
    if (this.active.get(run.address.sessionId) !== run) return false;
    this.active.delete(run.address.sessionId);
    if (!run.acceptsEvents) run.onAbortedSettled?.();
    return true;
  }
}
