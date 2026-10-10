import type { RegistrationClientContext } from './client-contracts.js';
import { enrollRegistrationClient } from './client-enrollment.js';
import { openRegistrationSession } from './client-session.js';
import { heartbeatRegistrationSession } from './client-heartbeat.js';

export async function registrationClientLoop(context: RegistrationClientContext): Promise<void> {
  const identity = await enrollRegistrationClient(context);
  for (;;) {
    const session = await openRegistrationSession(context, identity);
    context.emit({ state: 'online', phase: 'session' });
    await heartbeatRegistrationSession(context, session);
  }
}
