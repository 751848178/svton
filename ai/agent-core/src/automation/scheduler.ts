/**
 * Automation scheduler abstraction.
 *
 * The scheduler is responsible for firing a handler at a specific time.
 * The default {@link TimerScheduler} uses `setTimeout`, but platforms can
 * provide their own implementation (e.g. a persistent OS-level scheduler).
 */

export interface IAutomationScheduler {
  /**
   * Schedule `handler` to run at approximately `nextRunAt` (epoch ms).
   * Returns a cancel function.
   */
  schedule(nextRunAt: number, handler: () => Promise<void>): () => void;
}

export class TimerScheduler implements IAutomationScheduler {
  schedule(nextRunAt: number, handler: () => Promise<void>): () => void {
    const delay = Math.max(0, nextRunAt - Date.now());
    const id = setTimeout(() => {
      handler().catch(() => {});
    }, delay);
    return () => clearTimeout(id);
  }
}
