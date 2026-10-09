// Post-deploy healthcheck polling against the app's declared host port.

export interface HealthOutcome {
  healthy: boolean;
  skipped: boolean;
  attempts: number;
  lastStatus?: number;
  lastError?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitHealthy(o: {
  url: string;
  timeoutMs: number;
  intervalMs?: number;
  log: (line: string) => void;
  /** Cooperative cancellation between probe requests; recovery omits this hook. */
  checkpoint?: () => void;
}): Promise<HealthOutcome> {
  const interval = o.intervalMs ?? 2000;
  const deadline = Date.now() + o.timeoutMs;
  let attempts = 0;
  let lastError: string | undefined;
  for (;;) {
    o.checkpoint?.();
    attempts++;
    try {
      const res = await fetch(o.url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        o.log(`healthcheck ok after ${attempts} attempt(s) (HTTP ${res.status})`);
        return { healthy: true, skipped: false, attempts, lastStatus: res.status };
      }
      lastError = `HTTP ${res.status}`;
      o.log(`healthcheck attempt ${attempts}: HTTP ${res.status}`);
    } catch (e) {
      lastError = (e as Error).message;
      o.log(`healthcheck attempt ${attempts}: ${lastError}`);
    }
    o.checkpoint?.();
    if (Date.now() + interval > deadline) break;
    await sleep(interval);
  }
  return { healthy: false, skipped: false, attempts, lastError };
}
