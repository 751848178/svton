import { RegistrationRequestError } from './request-errors.js';
import { REGISTRATION_LEASE_MS } from '../../shared/registration-contracts.js';
import { RegistrationClientFailure, clientErrorStatus } from './status.js';
import type { RegistrationClientContext, RegistrationClientPhase } from './client-contracts.js';

export function abortableClientOperation<T>(signal: AbortSignal, operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, value: unknown): void => {
      if (settled) return; settled = true; signal.removeEventListener('abort', abort);
      if (ok) resolve(value as T); else reject(value);
    };
    const abort = (): void => finish(false, new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED'));
    signal.addEventListener('abort', abort, { once: true });
    operation.then(value => finish(true, value), error => finish(false, error));
    if (signal.aborted) abort();
  });
}
export function waitForRegistration(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (abort: boolean): void => {
      clearTimeout(timer); signal.removeEventListener('abort', aborted);
      if (abort) reject(new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED')); else resolve();
    };
    const aborted = (): void => finish(true), timer = setTimeout(() => finish(false), milliseconds);
    signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted();
  });
}
export async function clientPause(context: RegistrationClientContext, milliseconds: number): Promise<void> {
  if (context.options.signal.aborted) throw new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED');
  await abortableClientOperation(context.options.signal, context.clock.wait(milliseconds, context.options.signal));
}
export function registrationRetryable(error: unknown): boolean {
  return error instanceof RegistrationRequestError && (error.code === 'REGISTRATION_CONNECTION_FAILED'
    || error.code === 'REGISTRATION_REQUEST_TIMEOUT' || (error.code === 'REGISTRATION_HTTP_REJECTED'
      && typeof error.statusCode === 'number' && error.statusCode >= 500 && error.statusCode <= 599));
}
export async function retryRegistration<T>(context: RegistrationClientContext, phase: RegistrationClientPhase,
  operation: () => Promise<T>, sessionConflict = false): Promise<T> {
  let failures = 0;
  for (;;) {
    if (context.options.signal.aborted) throw new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED');
    try { return await abortableClientOperation(context.options.signal, operation()); }
    catch (error) {
      if (context.options.signal.aborted) throw new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED');
      const conflict = sessionConflict && error instanceof RegistrationRequestError && error.code === 'REGISTRATION_HTTP_REJECTED'
        && error.statusCode === 409 && error.remoteCode === 'AGENT_SESSION_CONFLICT';
      if (!conflict && !registrationRetryable(error)) throw error;
      context.emit({ state: 'retrying', phase, ...clientErrorStatus(error) });
      const random = context.clock.random();
      if (!Number.isFinite(random) || random < 0 || random > 1) throw new RegistrationClientFailure('REGISTRATION_CLIENT_INPUT_INVALID');
      const capped = Math.min(30_000, 1_000 * 2 ** Math.min(failures++, 5));
      await clientPause(context, conflict ? REGISTRATION_LEASE_MS : Math.floor(capped * (0.5 + random / 2)));
    }
  }
}
