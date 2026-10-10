import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { Prisma } from '../../generated/client/index.js';
import type { DatabaseService } from '../database/database.service.js';
import { databaseFixture } from '../testing/database.fixture.js';
import { enrollmentFault } from './enrollment.fixture.js';
import { registrationTransaction } from './transaction.js';

test('real SQLite expired interactive transactions retry finitely and roll back identity plus audit', async () => {
  const h = await databaseFixture();
  try {
    let attempts = 0;
    const action = `registration.timeout.${randomUUID()}`;
    // Only the timeout changes: every attempt uses the actual Prisma transaction and SQLite database.
    const timeoutDb = { $transaction: <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) =>
      h.db.$transaction(operation, { timeout: 40 }) } as DatabaseService;
    await assert.rejects(registrationTransaction(timeoutDb, async tx => {
      attempts++;
      const actorId = randomUUID();
      await tx.actor.create({ data: { id: actorId, kind: 'machine', name: action } });
      await tx.audit.create({ data: { actorId, workspaceId: 'local', requestId: randomUUID(),
        action, resourceType: 'agent', resourceId: randomUUID(), outcome: 'succeeded' } });
      await delay(80);
      return tx.actor.count();
    }), enrollmentFault('REGISTRATION_BUSY'));
    assert.equal(attempts, 3);
    assert.equal(await h.db.actor.count({ where: { name: action } }), 0);
    assert.equal(await h.db.audit.count({ where: { action } }), 0);
  } finally { await h.dispose(); }
});

test('a genuine non-expiry P2028 from a committed transaction is not retried or relabeled busy', async () => {
  const h = await databaseFixture();
  try {
    let attempts = 0;
    const committed = await h.db.$transaction(async tx => tx);
    await assert.rejects(registrationTransaction(h.db, async () => {
      attempts++;
      return committed.actor.count();
    }), error => !!error && typeof error === 'object' && 'code' in error && error.code === 'P2028'
      && 'message' in error && /committed transaction/i.test(String(error.message)));
    assert.equal(attempts, 1);
  } finally { await h.dispose(); }
});
