import { parseAgentSessionOpenRequest } from '../../shared/registration-validation.js';
import { parseAgentSessionOpenReceipt } from '../../shared/registration-receipts.js';
import type { RegisteredIdentity } from './identity-contracts.js';
import type { RegistrationClientContext, RegistrationClientSession } from './client-contracts.js';
import { assertClientIdentity } from './client-enrollment.js';
import { registrationClientStatus } from './status.js';
import { abortableClientOperation, retryRegistration } from './retry.js';
import { clientReceipt } from './client-response.js';

export async function openRegistrationSession(context: RegistrationClientContext, identity: RegisteredIdentity): Promise<RegistrationClientSession> {
  const status = await abortableClientOperation(context.options.signal, registrationClientStatus(context));
  const dto = parseAgentSessionOpenRequest({ v: 1, agentId: identity.receipt.agentId,
    incarnation: identity.receipt.incarnation, bootId: context.bootId, status });
  const request = Object.freeze({ phase: 'session' as const, serverOrigin: identity.serverOrigin,
    caFile: context.options.config.caFile, credential: identity.machineCredential, dto, signal: context.options.signal });
  context.emit({ state: 'opening', phase: 'session' });
  const receipt = clientReceipt(parseAgentSessionOpenReceipt, await retryRegistration(context, 'session', async () => {
    assertClientIdentity(context, identity); return context.request(request);
  }, true));
  assertClientIdentity(context, identity);
  return Object.freeze({ identity, epoch: receipt.epoch, lastSequence: receipt.lastSequence, intervalMs: receipt.heartbeatIntervalMs });
}
