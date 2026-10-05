// Bounded SIGINT/SIGTERM cancellation (R09): while an active task owns an
// expensive resource (a dynamic builder machine), the default "die on signal"
// behavior would leak it until the cloud timer fires. This guard intercepts
// the FIRST signal, runs a bounded cleanup callback, then re-raises the signal
// so the process still exits with conventional semantics (130/143). A second
// signal bypasses the guard entirely.

export interface CancelGuard {
  /** remove the handlers (normal completion — nothing to cancel anymore) */
  dispose(): void;
}

const DEFAULT_CLEANUP_BUDGET_MS = 10_000;

export function armCancellation(o: {
  onCancel: () => Promise<void>;
  log: (msg: string, meta?: Record<string, unknown>) => void;
  timeoutMs?: number;
  signals?: NodeJS.Signals[];
}): CancelGuard {
  const signals = o.signals ?? ['SIGINT', 'SIGTERM'];
  const budgetMs = o.timeoutMs ?? DEFAULT_CLEANUP_BUDGET_MS;
  let cancelling = false;

  const handler = (signal: NodeJS.Signals) => {
    if (cancelling) {
      // second signal: restore default behavior immediately
      detach();
      process.kill(process.pid, signal);
      return;
    }
    cancelling = true;
    o.log(`received ${signal} — running bounded cleanup before exit (${Math.round(budgetMs / 1000)}s budget)`);
    const bounded = Promise.race([
      o.onCancel().then(() => 'released' as const),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), budgetMs).unref()),
    ]);
    bounded.then((outcome) => {
      if (outcome === 'timeout') {
        o.log(`cleanup did not finish within the budget — the resource may still exist; verify manually`, { signal });
      }
    }).catch((e: unknown) => {
      o.log(`cleanup failed: ${String((e as Error)?.message ?? e)} — the resource may still exist; verify manually`, { signal });
    }).finally(() => {
      detach();
      // re-raise so the shell sees the conventional signal exit, not exit 0
      process.kill(process.pid, signal);
    });
  };

  const detach = () => {
    for (const sig of signals) {
      process.removeListener(sig, handler as never);
    }
  };
  for (const sig of signals) process.on(sig, handler as never);
  return { dispose: detach };
}
