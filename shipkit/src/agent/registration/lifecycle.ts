import type { RegistrationStatus } from '../../shared/registration-contracts.js';
import type { RegistrationConfig } from './identity-contracts.js';
import { withRegistrationIdentity } from './identity-store.js';
import { runRegistrationClient } from './client.js';
import type { RegistrationClientStatus } from './client-contracts.js';

interface Closeable { close(): Promise<void> }
export interface AgentRegistrationLifecycle<T extends Closeable> {
  workRoot: string;
  config: RegistrationConfig;
  status(signal: AbortSignal): Promise<RegistrationStatus>;
  start(): Promise<T>;
  onStatus?(status: RegistrationClientStatus): void;
  /** The same lifecycle contract supports deterministic transport fault schedules. */
  client?: typeof runRegistrationClient;
}
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Own the identity before start() may recover or modify the durable Job ledger. */
export async function withAgentRegistration<T extends Closeable>(options: AgentRegistrationLifecycle<T>): Promise<T> {
  if (options.config.mode === 'disabled') return options.start();
  const config = options.config;
  const abort = new AbortController(), ready = deferred<T>(), stopped = deferred<void>();
  let handle: T | undefined, client: Promise<void> | undefined, closing: Promise<void> | undefined;
  const close = (): Promise<void> => closing ??= (async () => {
    abort.abort();
    let httpClosing: Promise<void>;
    try { httpClosing = handle!.close(); } catch (error) { httpClosing = Promise.reject(error); }
    let failures: PromiseRejectedResult[];
    try {
      failures = (await Promise.allSettled([httpClosing, client!]))
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    }
    finally { stopped.resolve(); await owner; }
    if (failures.length) throw failures[0]!.reason;
  })();
  // Keep this promise observed immediately, including failures before lock acquisition.
  const owner = (async () => {
    const initialStatus = await options.status(abort.signal);
    await withRegistrationIdentity(options.workRoot, config, { initialStatus }, async store => {
      handle = await options.start();
      client = Promise.resolve().then(() => (options.client ?? runRegistrationClient)({ config, store, status: options.status,
        signal: abort.signal, ...(options.onStatus ? { onStatus: options.onStatus } : {}) }));
      // A controlled client failure must never erase identity or interrupt direct jobs.
      client = client.catch(() => {
        try { options.onStatus?.({ state: 'stopped', code: 'REGISTRATION_CLIENT_FAILED' }); } catch { /* observer only */ }
      });
      ready.resolve({ ...handle, close });
      await stopped.promise;
      await client;
    });
  })();
  void owner.catch(error => { abort.abort(); ready.reject(error); });
  try { return await ready.promise; }
  catch (error) { await owner.catch(() => undefined); throw error; }
}
