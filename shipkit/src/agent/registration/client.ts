import { randomUUID } from 'node:crypto';
import { parseRegistrationIdentifier } from '../../shared/registration-validation.js';
import type { RegistrationClientContext, RegistrationClientOptions } from './client-contracts.js';
import { requestRegistration } from './request.js';
import { registrationClientLoop } from './client-loop.js';
import { waitForRegistration } from './retry.js';
import { RegistrationClientFailure, clientErrorStatus } from './status.js';

/** Runs only the registration control loop; fatal failures preserve identity and stop this loop. */
export async function runRegistrationClient(options: RegistrationClientOptions): Promise<void> {
  const emit: RegistrationClientContext['emit'] = event => { try { options.onStatus?.(Object.freeze(event)); } catch { /* Observers cannot change the protocol. */ } };
  try {
    if (options.config.mode !== 'persistent' || !(options.signal instanceof AbortSignal)) throw new RegistrationClientFailure('REGISTRATION_CLIENT_INPUT_INVALID');
    if (options.signal.aborted) throw new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED');
    const context: RegistrationClientContext = { options, bootId: parseRegistrationIdentifier(options.bootId ?? randomUUID()),
      request: options.request ?? requestRegistration,
      clock: options.clock ?? { now: Date.now, wait: waitForRegistration, random: Math.random }, emit };
    await registrationClientLoop(context);
  } catch (error) {
    emit({ state: 'stopped', ...clientErrorStatus(options.signal?.aborted ? new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED') : error) });
  }
}
