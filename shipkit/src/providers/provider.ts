// Builder provider contract: static bound machines today, cloud adapters (tencent first) for dynamic builders.

export interface BuilderHandle {
  url: string;
  token: string;
}

export interface BuilderProviderStatus {
  kind: string;
  active: boolean;
  url?: string;
  detail?: Record<string, unknown>;
}

export type ProviderLog = (msg: string, meta?: Record<string, unknown>) => void;

export interface BuilderProvider {
  readonly kind: string;
  /**
   * Return a usable builder agent endpoint, creating/reusing the machine as needed.
   * taskBudgetMs is the FULL expected task duration; a machine whose cloud terminate deadline
   * cannot cover it must not be reused (RA03).
   */
  ensure(log: ProviderLog, taskBudgetMs?: number): Promise<BuilderHandle>;
  /** Release the builder machine (no-op for bound static machines). */
  release(): Promise<void>;
  status(): Promise<BuilderProviderStatus>;
  /**
   * Run one build/push task under an exclusive lease: the machine cannot be destroyed or
   * re-admitted by another CLI while the task runs; idle is anchored at task completion (RA04).
   */
  runExclusive?<T>(log: ProviderLog, taskBudgetMs: number, fn: (handle: BuilderHandle) => Promise<T>): Promise<T>;
}
