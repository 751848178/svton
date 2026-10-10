import type { Prisma } from '../../generated/client/index.js';
import type { RequestContext } from '../policy/request-context.js';
import { registrationFault } from './fault.js';

export async function assertHumanContext(tx: Prisma.TransactionClient, context: RequestContext, now: Date): Promise<void> {
  if (context.source !== 'session' || !context.sessionId || !context.actorId || context.workspaceId !== 'local') {
    registrationFault('REGISTRATION_UNAUTHORIZED');
  }
  const session = await tx.authSession.findUnique({ where: { id: context.sessionId }, include: { actor: true } });
  if (!session || session.actorId !== context.actorId || session.expiresAt <= now || session.actor.disabled
    || session.actor.kind !== 'user' || !session.actor.username || !session.actor.passwordHash) {
    registrationFault('REGISTRATION_UNAUTHORIZED');
  }
}
