import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Global, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AppModule } from '../app.module.js';
import { databaseFixture } from '../testing/database.fixture.js';

export async function registrationHttpFixture(mode: 'disabled' | 'local-development' = 'local-development', compiled = false) {
  const previousMode = process.env.SHIPKIT_AGENT_INGRESS_MODE;
  process.env.SHIPKIT_AGENT_INGRESS_MODE = mode;
  const fixture = await databaseFixture(); let now = new Date();
  class FixtureClock {}
  Global()(FixtureClock); Module({ providers: [{ provide: 'REGISTRATION_CLOCK', useValue: () => new Date(now) }],
    exports: ['REGISTRATION_CLOCK'] })(FixtureClock);
  const root = compiled ? (await import(pathToFileURL(path.join(process.cwd(), 'dist/app.module.js')).href)).AppModule : AppModule;
  class FixtureRoot {}
  Module({ imports: [FixtureClock, root] })(FixtureRoot);
  const app = await NestFactory.create(FixtureRoot, { logger: false });
  await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
  const send = (route: string, options: RequestInit = {}) => fetch(`${base}${route}`, options);
  const json = (body: unknown, headers: Record<string, string> = {}) => ({ method: 'POST',
    headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const password = randomBytes(24).toString('base64url'), user = await fixture.seedAccount('http-registration-admin', password);
  const login = await send('/api/auth/login', json({ username: user.username, password }, { 'x-shipkit-local': '1' }));
  assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  const human = (route: string, body?: unknown) => send(route, body === undefined
    ? { headers: { cookie } } : json(body, { cookie, 'x-shipkit-local': '1' }));
  const machine = (route: string, secret: string, body: unknown, headers: Record<string, string> = {}) =>
    send(route, json(body, { authorization: `Bearer ${secret}`, ...headers }));
  const enroll = async (approvedRole: 'runtime' | 'builder' | 'both' = 'runtime') => {
    const issue = await human('/api/registered-agents/enrollments', { v: 1, name: 'HTTP isolated machine', approvedRole, resourceKind: 'persistent' });
    assert.equal(issue.status, 201); const issued = await issue.json();
    const { generateMachineSecret } = await import('shipkit/platform');
    const credential = generateMachineSecret(), incarnation = randomUUID();
    const consume = { v: 1, enrollmentId: issued.enrollmentId, attemptId: randomUUID(), incarnation,
      machineCredential: credential, reportedRole: 'both', metadata: { version: '0.0.1', docker: true, capabilities: ['runtime', 'builder'] } };
    const response = await machine('/api/agent-registration/enroll', issued.code, consume);
    assert.equal(response.status, 201); const receipt = await response.json();
    return { credential, issued, consume, receipt, request: { v: 1, agentId: receipt.agentId, incarnation,
      bootId: randomUUID(), status: { reportedRole: 'both', ...consume.metadata } } };
  };
  return { ...fixture, app, send, human, machine, json, cookie, user, enroll,
    get now() { return new Date(now); }, advance: (ms: number) => { now = new Date(now.getTime() + ms); },
    close: async () => { await app.close(); await fixture.dispose();
      if (previousMode === undefined) delete process.env.SHIPKIT_AGENT_INGRESS_MODE; else process.env.SHIPKIT_AGENT_INGRESS_MODE = previousMode; },
  };
}

export async function responseBody(response: Response, status: number) {
  assert.equal(response.status, status); return response.json();
}
export function privateFree(value: unknown, ...secrets: string[]): void {
  const encoded = JSON.stringify(value);
  assert(!/credentialHash|tokenHash|requestHash|openRequestHash|lastPayloadHash|lastReceiptJson|machineContext|passwordHash/.test(encoded));
  for (const secret of secrets) assert(!encoded.includes(secret));
}
