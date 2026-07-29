interface ActiveChatRun {
  generation: number;
  sessionId: string | null;
  assistantMessageId: string;
  acceptsEvents: boolean;
  onAbortedSettled: (() => void) | null;
}

export interface ChatRunLease {
  readonly sessionId: string | null;
  acceptsEvents: () => boolean;
  release: () => boolean;
}

/** Keeps one runtime run owned until its generator has fully settled. */
export class ChatRunOwnershipService {
  private generation = 0;
  private active: ActiveChatRun | null = null;
  readonly assistantMessageId = { current: null as string | null };

  get isProcessing(): boolean {
    return this.active !== null;
  }

  begin(sessionId: string | null, assistantMessageId: string): ChatRunLease | null {
    if (this.active) return null;
    const run: ActiveChatRun = {
      generation: ++this.generation,
      sessionId,
      assistantMessageId,
      acceptsEvents: true,
      onAbortedSettled: null,
    };
    this.active = run;
    this.assistantMessageId.current = assistantMessageId;
    return {
      sessionId,
      acceptsEvents: () => this.active === run && run.acceptsEvents,
      release: () => this.release(run),
    };
  }

  abortActive(onIdle?: () => void): void {
    if (this.active) {
      this.active.acceptsEvents = false;
      this.active.onAbortedSettled ??= onIdle ?? null;
      return;
    }
    onIdle?.();
  }

  private release(run: ActiveChatRun): boolean {
    if (this.active !== run) return false;
    this.active = null;
    if (this.assistantMessageId.current === run.assistantMessageId) {
      this.assistantMessageId.current = null;
    }
    if (!run.acceptsEvents) run.onAbortedSettled?.();
    return true;
  }
}
