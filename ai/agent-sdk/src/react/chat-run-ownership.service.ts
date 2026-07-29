interface ActiveSdkChatRun {
  generation: number;
  acceptsEvents: boolean;
  resetOnSettlement: boolean;
}

export interface SdkChatRunSettlement {
  released: boolean;
  resetRequested: boolean;
}

export interface SdkChatRunLease {
  acceptsEvents: () => boolean;
  release: () => SdkChatRunSettlement;
}

/** Owns one SDK chat generator until exhaustive settlement. */
export class SdkChatRunOwnershipService {
  private generation = 0;
  private active: ActiveSdkChatRun | null = null;

  get isProcessing(): boolean {
    return this.active !== null;
  }

  begin(): SdkChatRunLease | null {
    if (this.active) return null;
    const run: ActiveSdkChatRun = {
      generation: ++this.generation,
      acceptsEvents: true,
      resetOnSettlement: false,
    };
    this.active = run;
    return {
      acceptsEvents: () =>
        this.active === run
        && run.generation === this.generation
        && run.acceptsEvents,
      release: () => this.release(run),
    };
  }

  invalidateActive(resetOnSettlement = false): boolean {
    if (!this.active) return false;
    this.active.acceptsEvents = false;
    this.active.resetOnSettlement ||= resetOnSettlement;
    return true;
  }

  private release(run: ActiveSdkChatRun): SdkChatRunSettlement {
    if (this.active !== run) {
      return { released: false, resetRequested: false };
    }
    this.active = null;
    return { released: true, resetRequested: run.resetOnSettlement };
  }
}
