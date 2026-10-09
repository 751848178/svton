import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { databaseFixture } from '../testing/database.fixture.js';
import { AccountAdmin } from './accounts.js';
import { SessionStore } from './session-store.js';
import { sessionHash } from './cookie.js';
import { AuthSettings } from './settings.js';

const writeHeaders = { 'Content-Type': 'application/json', 'x-shipkit-local': '1' };
async function harness(origin?: string) {
  const previous = process.env.SHIPKIT_PUBLIC_ORIGIN;
  if (origin) process.env.SHIPKIT_PUBLIC_ORIGIN = origin; else delete process.env.SHIPKIT_PUBLIC_ORIGIN;
  const fixture = await databaseFixture();
  let app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1'); let base = await app.getUrl();
  const send = (route: string, cookie?: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers); if (cookie) headers.set('cookie', cookie);
    return fetch(`${base}${route}`, { ...options, headers });
  };
  const login = (username: string, password: string, headers = writeHeaders) => send('/api/auth/login', undefined,
    { method: 'POST', headers, body: JSON.stringify({ username, password }) });
  return { ...fixture, send, login, restart: async () => {
    await app.close(); app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1'); base = await app.getUrl();
  }, close: async () => {
    await app.close(); await fixture.dispose();
    if (previous === undefined) delete process.env.SHIPKIT_PUBLIC_ORIGIN; else process.env.SHIPKIT_PUBLIC_ORIGIN = previous;
  } };
}
const cookieOf = (response: Response) => response.headers.get('set-cookie')!.split(';')[0]!;
const post = (body: unknown = {}) => ({ method: 'POST', headers: writeHeaders, body: JSON.stringify(body) });

test('empty installation is closed for business reads and writes; health and protected logout remain usable', async () => {
  const h = await harness();
  try {
    const health = await h.send('/api/health'); assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: 'ok' });
    for (const route of ['/api/auth/session', '/api/projects', '/api/agents', '/api/tasks/missing', '/api/tasks/missing/events', '/api/tasks/missing/logs?stage=build', '/api/projects/missing/history']) {
      assert.equal((await h.send(route)).status, 401);
    }
    for (const route of ['/api/projects', '/api/tasks/missing/cancel', '/api/agents/missing/checks']) assert.equal((await h.send(route, undefined, post())).status, 401);
    const unknown = await h.login('unknown-user', randomBytes(18).toString('base64url'));
    assert.equal(unknown.status, 401); assert.equal((await unknown.json()).message, '登录凭据无效或会话已失效');
    assert.equal((await h.send('/api/auth/login', undefined, post({}))).status, 401);
    assert.equal((await h.send('/api/auth/login', undefined, post(null))).status, 400);
    const logout = await h.send('/api/auth/logout', undefined, post()); assert.equal(logout.status, 200); assert.deepEqual(await logout.json(), { ok: true });
    assert.equal((await h.send('/api/auth/logout', undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await h.send('/api/auth/logout', undefined, { ...post(), headers: { ...writeHeaders, Origin: 'https://evil.example' } })).status, 403);
    assert.equal(await h.db.authSession.count(), 0);
  } finally { await h.close(); }
});

test('real session is opaque, durable through API restart, and audited using the authenticated Actor', async () => {
  const h = await harness(), password = randomBytes(24).toString('base64url');
  try {
    const user = await h.seedAccount('Operator-One', password, 'Operator');
    const response = await h.login(' OPERATOR-ONE ', password);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const view = await response.json(), cookie = cookieOf(response), token = cookie.split('=')[1]!;
    assert.deepEqual(Object.keys(view).sort(), ['expiresAt', 'user']); assert.deepEqual(view.user, user);
    assert(Number.isFinite(Date.parse(view.expiresAt))); assert(!JSON.stringify(view).includes(token)); assert(!JSON.stringify(view).includes(password));
    const header = response.headers.get('set-cookie')!;
    assert(header.includes('HttpOnly')); assert(header.includes('SameSite=Strict')); assert(header.includes('Path=/')); assert(!header.includes('Secure'));
    const persisted = await h.db.authSession.findFirstOrThrow(); assert(persisted.id !== token); assert.equal(persisted.id, sessionHash(token));
    const actor = await h.db.actor.findUniqueOrThrow({ where: { id: user.id } }); assert(actor.passwordHash !== password); assert.equal(actor.kind, 'user');
    assert.deepEqual(await (await h.send('/api/auth/session', cookie)).json(), view);
    assert.equal((await h.send('/api/projects', cookie)).status, 200); assert.equal((await h.send('/api/agents', cookie)).status, 200);
    await h.restart(); assert.deepEqual(await (await h.send('/api/auth/session', cookie)).json(), view);
    assert.equal((await h.send('/api/auth/session', cookie.replace(token, randomBytes(32).toString('base64url')))).status, 401);
    assert.equal((await h.send('/api/auth/session', `${cookie}; ${cookie}`)).status, 401);
    const audits = await h.db.audit.findMany({ where: { action: 'auth.login' } }); assert.equal(audits.length, 1); assert.equal(audits[0]?.actorId, user.id);
    assert(await h.db.actor.findUnique({ where: { id: 'local-controller' } }));
  } finally { await h.close(); }
});

test('logout revokes only that session and expiration removes the stale server session', async () => {
  const h = await harness(), password = randomBytes(24).toString('base64url');
  try {
    const user = await h.seedAccount('operator-two', password);
    const first = cookieOf(await h.login(user.username, password)), second = cookieOf(await h.login(user.username, password));
    const denied = await h.send('/api/auth/logout', first, { ...post(), headers: { ...writeHeaders, Origin: 'null' } }); assert.equal(denied.status, 403);
    assert.equal((await h.send('/api/auth/session', first)).status, 200);
    const logout = await h.send('/api/auth/logout', first, post()); assert.deepEqual(await logout.json(), { ok: true });
    assert.equal((await h.send('/api/auth/session', first)).status, 401); assert.equal((await h.send('/api/auth/session', second)).status, 200);
    assert.equal((await h.send('/api/auth/logout', first, post())).status, 200);
    const token = second.split('=')[1]!; await h.db.authSession.update({ where: { id: sessionHash(token) }, data: { expiresAt: new Date(0) } });
    assert.equal((await h.send('/api/auth/session', second)).status, 401); assert.equal(await h.db.authSession.count(), 0);
    const audits = await h.db.audit.findMany({ where: { action: 'auth.logout' } }); assert.equal(audits.length, 1); assert.equal(audits[0]?.actorId, user.id);
  } finally { await h.close(); }
});

test('atomic disable and password reset revoke sessions and reject an in-flight login with an obsolete password hash', async () => {
  const h = await harness(), password = randomBytes(24).toString('base64url');
  try {
    const user = await h.seedAccount('operator-three', password), accounts = new AccountAdmin(h.db), sessions = new SessionStore(h.db);
    const oldHash = (await h.db.actor.findUniqueOrThrow({ where: { id: user.id } })).passwordHash!;
    const cookie = cookieOf(await h.login(user.username, password));
    await accounts.disable(user.username); assert.equal(await h.db.authSession.count(), 0);
    assert.equal((await h.send('/api/auth/session', cookie)).status, 401);
    const disabled = await h.login(user.username, password), missing = await h.login('absent-three', password);
    assert.equal(disabled.status, 401); const disabledError = await disabled.json(), missingError = await missing.json();
    assert.equal(disabledError.code, missingError.code); assert.equal(disabledError.message, missingError.message);
    await assert.rejects(sessions.create(user.id, oldHash, 'pending-disabled', new Date(Date.now() + 10000), 'race-disabled'));
    const replacement = randomBytes(24).toString('base64url'); const restored = await accounts.upsert(user.username, replacement);
    assert.equal(restored.id, user.id); assert.equal((await h.login(user.username, password)).status, 401);
    const current = cookieOf(await h.login(user.username, replacement)); assert.equal((await h.send('/api/projects', current)).status, 200);
    await accounts.upsert(user.username, randomBytes(24).toString('base64url'));
    assert.equal((await h.send('/api/auth/session', current)).status, 401);
    await assert.rejects(sessions.create(user.id, oldHash, 'pending-old-hash', new Date(Date.now() + 10000), 'race-reset'));
    assert.equal(await h.db.authSession.count(), 0);
  } finally { await h.close(); }
});

test('HTTPS is explicit and cookie Secure cannot be weakened by forwarded headers; configured Origin is exact', async () => {
  const h = await harness('https://shipkit.example'), password = randomBytes(24).toString('base64url');
  try {
    await h.seedAccount('operator-four', password);
    const response = await h.login('operator-four', password, { ...writeHeaders, Origin: 'https://shipkit.example', 'x-forwarded-proto': 'http' });
    assert.equal(response.status, 200); assert(response.headers.get('set-cookie')!.includes('Secure'));
    assert.equal((await h.login('operator-four', password, { ...writeHeaders, Origin: 'http://127.0.0.1:8769' })).status, 403);
    assert.equal((await h.login('operator-four', password, { ...writeHeaders, Origin: 'https://shipkit.example/path' })).status, 403);
    const old = process.env.SHIPKIT_PUBLIC_ORIGIN;
    for (const origin of ['http://shipkit.example', 'https://shipkit.example/path', 'https://user:secret@shipkit.example', 'null']) {
      process.env.SHIPKIT_PUBLIC_ORIGIN = origin; assert.throws(() => new AuthSettings());
    }
    process.env.SHIPKIT_PUBLIC_ORIGIN = old;
  } finally { await h.close(); }
});

test('login budget limits repeated attempts without exposing whether an account exists', async () => {
  const h = await harness();
  try {
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await h.login('budget-unknown', 'invalid-password')).status, 401);
    const limited = await h.login('budget-unknown', 'invalid-password'); assert.equal(limited.status, 429);
    const text = await limited.text(); assert(!text.includes('budget-unknown')); assert(!text.includes('invalid-password'));
    assert.equal(await h.db.authSession.count(), 0);
  } finally { await h.close(); }
});
