import { setTimeout as delay } from 'node:timers/promises';
import type { Prisma } from '../../generated/client/index.js';
import type { DatabaseService } from '../database/database.service.js';
import { registrationFault } from './fault.js';

export type RegistrationClock = () => Date;
function retryable(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = String(error.code);
  if (['P1008', 'P2034', 'P2002'].includes(code)) return code;
  if (code === 'P2028' && 'message' in error && /timed out|expired transaction|database is locked|deadlock/i.test(String(error.message))) return code;
  return undefined;
}

/** Retry only fully rolled-back SQLite transactions, retaining the caller's frozen request. */
export async function registrationTransaction<T>(
  db: DatabaseService,
  operation: (tx: Prisma.TransactionClient, now: Date) => Promise<T>,
  clock: RegistrationClock = () => new Date(),
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(tx => {
        const now = clock();
        if (!(now instanceof Date) || !Number.isFinite(now.getTime())) registrationFault('AGENT_CLOCK_INVALID');
        return operation(tx, new Date(now.getTime()));
      });
    } catch (error) {
      const code = retryable(error);
      if (!code) throw error;
      if (attempt === 2) registrationFault(code === 'P2002' ? 'REGISTRATION_CONFLICT' : 'REGISTRATION_BUSY');
      await delay(20 * (attempt + 1));
    }
  }
  return registrationFault('REGISTRATION_BUSY');
}
