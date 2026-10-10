import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { AgentHeartbeatRequest, AgentSessionOpenRequest } from 'shipkit/platform';
import { databaseFixture } from '../testing/database.fixture.js';
import { DatabaseService } from '../database/database.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { MachineAuthService } from './machine-auth.service.js';
import type { MachineContext } from './machine-request.js';
import { AgentSessionRepository } from './agent-session.repository.js';
import { AgentStateRepository } from './agent-state.repository.js';

export async function sessionFixture() {
  const { generateMachineSecret, hashMachineSecret } = await import('shipkit/platform');
  const fixture = await databaseFixture();
  let db = fixture.db, now = new Date();
  const credential = generateMachineSecret(), hash = hashMachineSecret(credential);
  const actorId = randomUUID(), agentId = randomUUID(), incarnation = randomUUID(), bootId = randomUUID();
  await db.actor.create({ data: { id: actorId, name: 'Isolated test machine', kind: 'machine' } });
  await db.agent.create({ data: { id: agentId, actorId, workspaceId: 'local', name: 'Isolated Agent', incarnation,
    resourceKind: 'persistent', approvedRole: 'runtime', credentialHash: hash } });
  const user = await fixture.seedAccount('registration-admin', randomBytes(24).toString('base64url'));
  const sessionId = randomUUID();
  await db.authSession.create({ data: { id: sessionId, actorId: user.id, expiresAt: new Date(now.getTime() + 86400000) } });
  const human: RequestContext = { actorId: user.id, workspaceId: 'local', requestId: randomUUID(), source: 'session', sessionId };
  const request: AgentSessionOpenRequest = { v: 1, agentId, incarnation, bootId,
    status: { reportedRole: 'both', version: '0.0.1', docker: true, capabilities: ['runtime'] } };
  const machine = async (secret = credential): Promise<MachineContext> => {
    const context = await new MachineAuthService(db).authenticate('machine', `Bearer ${secret}`);
    assert.equal(context.kind, 'machine'); return context as MachineContext;
  };
  return {
    get db() { return db; }, credential, hash, actorId, agentId, incarnation, bootId, request, human, machine,
    get now() { return new Date(now); }, at: (value: Date) => { now = value; }, advance: (ms: number) => { now = new Date(now.getTime() + ms); },
    sessions: () => new AgentSessionRepository(db, () => new Date(now)),
    controls: () => new AgentStateRepository(db, () => new Date(now)),
    heartbeat: (epoch: number, sequence: number): AgentHeartbeatRequest => ({ ...request, epoch, sequence }),
    ledger: () => db.agentSession.findUniqueOrThrow({ where: { agentId } }),
    reload: async () => { await db.onModuleDestroy(); db = new DatabaseService(); await db.onModuleInit(); },
    dispose: async () => { if (db !== fixture.db) await db.onModuleDestroy(); await fixture.dispose(); },
  };
}
export function faultCode(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const body = error.getResponse();
  return typeof body === 'object' && body !== null && 'code' in body ? String(body.code) : undefined;
}
export async function rejected(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, error => faultCode(error) === code);
}
export function noSecrets(value: unknown, ...secrets: string[]): void {
  const output = JSON.stringify(value);
  assert(!/credentialHash|tokenHash|requestHash|passwordHash/.test(output));
  for (const secret of secrets) assert(!output.includes(secret));
}
