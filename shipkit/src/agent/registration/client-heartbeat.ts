import { REGISTRATION_COUNTER_MAX } from '../../shared/registration-contracts.js';
import { parseAgentHeartbeatRequest } from '../../shared/registration-validation.js';
import { parseAgentHeartbeatReceipt } from '../../shared/registration-receipts.js';
import type { RegistrationClientContext, RegistrationClientSession } from './client-contracts.js';
import { assertClientIdentity } from './client-enrollment.js';
import { RegistrationClientFailure, registrationClientStatus } from './status.js';
import { RegistrationRequestError } from './request-errors.js';
import { abortableClientOperation, clientPause, retryRegistration } from './retry.js';
import { clientReceipt } from './client-response.js';

export async function heartbeatRegistrationSession(context: RegistrationClientContext, session: RegistrationClientSession): Promise<void> {
  let lastSequence = session.lastSequence;
  for (;;) {
    if (lastSequence >= REGISTRATION_COUNTER_MAX) throw new RegistrationClientFailure('REGISTRATION_COUNTER_EXHAUSTED');
    await clientPause(context, session.intervalMs);
    const status = await abortableClientOperation(context.options.signal, registrationClientStatus(context));
    const dto = parseAgentHeartbeatRequest({ v: 1, agentId: session.identity.receipt.agentId,
      incarnation: session.identity.receipt.incarnation, bootId: context.bootId, status, epoch: session.epoch, sequence: lastSequence + 1 });
    const request = Object.freeze({ phase: 'heartbeat' as const, serverOrigin: session.identity.serverOrigin,
      caFile: context.options.config.caFile, credential: session.identity.machineCredential, dto, signal: context.options.signal });
    try {
      const receipt = clientReceipt(parseAgentHeartbeatReceipt, await retryRegistration(context, 'heartbeat', async () => {
        assertClientIdentity(context, session.identity); return context.request(request);
      }));
      if (receipt.epoch !== dto.epoch || receipt.sequence !== dto.sequence) throw new RegistrationRequestError('REGISTRATION_RESPONSE_INVALID');
      assertClientIdentity(context, session.identity); lastSequence = receipt.sequence;
      context.emit({ state: 'online', phase: 'heartbeat' });
    } catch (error) {
      if (error instanceof RegistrationRequestError && error.code === 'REGISTRATION_HTTP_REJECTED'
        && error.statusCode === 409 && error.remoteCode === 'AGENT_SESSION_EXPIRED') return;
      throw error;
    }
  }
}
