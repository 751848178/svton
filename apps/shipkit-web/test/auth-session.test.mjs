import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

function load(path, require, globals = {}) {
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021 } });
  const exports = {};
  runInNewContext(outputText, { exports, require, AbortController, ...globals });
  return exports;
}
const unauthorized = () => Object.assign(new Error('Not signed in'), { code: 401 });
function deferred() { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
function harness(request) {
  let now = Date.parse('2026-10-09T00:00:00Z');
  const timers = new Map(); let timerId = 0;
  const globals = { Date: class extends Date { static now() { return now; } }, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) };
  const events = load('auth/session-events', () => { throw Error('Unexpected dependency'); });
  const { SessionController } = load('auth/session-controller', () => events, globals);
  const { SessionCache } = load('auth/session-cache', () => { throw Error('Unexpected dependency'); });
  const controller = new SessionController(request);
  return { controller, events, SessionCache, advance(ms) { now += ms; for (const callback of [...timers.values()]) callback(); }, session(id = 'user-a') { return { user: { id, username: id, displayName: '测试用户' }, expiresAt: new Date(now + 60_000).toISOString() }; } };
}

test('initial unauthorized sessions remain anonymous; connection failures stay retryable without opening business UI', async () => {
  const h = harness(async () => { throw unauthorized(); });
  await h.controller.refresh();
  assert.equal(h.controller.getSnapshot().status, 'anonymous');
  let online = false;
  const retry = harness(async () => { if (!online) throw Error('offline'); return retry.session(); });
  await retry.controller.refresh();
  assert.equal(retry.controller.getSnapshot().status, 'unavailable');
  online = true;
  await retry.controller.refresh();
  assert.equal(retry.controller.getSnapshot().status, 'authenticated');
});

test('protected 401 retires caches and aborts pending work before the next user session starts', async () => {
  const h = harness(async route => route === 'POST:/auth/logout' ? { ok: true } : h.session());
  const stop = h.controller.start(); await h.controller.refresh();
  const cache = new h.SessionCache(); cache.set('private-project', { secret: true });
  h.controller.onInvalidate(() => cache.retire());
  const pending = new AbortController(); h.events.trackProtectedRequest(pending);
  const epoch = h.events.authEpoch();
  h.events.notifyUnauthorized(epoch);
  assert.equal(h.controller.getSnapshot().status, 'anonymous');
  assert.match(h.controller.getSnapshot().message, /失效/);
  assert.equal(pending.signal.aborted, true);
  assert.equal(cache.size, 0);
  cache.set('late-private-response', { secret: true });
  assert.equal(cache.size, 0);
  await h.controller.login({ username: 'user-a', password: 'not-persisted' });
  h.events.notifyUnauthorized(epoch);
  assert.equal(h.controller.getSnapshot().status, 'authenticated');
  stop();
});

test('incorrect credentials stay on the login form and a valid login starts a fresh cache generation', async () => {
  let valid = false;
  const h = harness(async route => { if (route !== 'POST:/auth/login' || !valid) throw unauthorized(); return h.session(); });
  await h.controller.refresh();
  await h.controller.login({ username: 'user-a', password: 'wrong' });
  assert.equal(h.controller.getSnapshot().status, 'anonymous');
  assert.equal(h.controller.getSnapshot().busy, false);
  assert.match(h.controller.getSnapshot().error, /账号或密码/);
  valid = true;
  await h.controller.login({ username: 'user-a', password: 'correct' });
  assert.equal(h.controller.getSnapshot().status, 'authenticated');
  assert.equal(h.controller.getSnapshot().session.user.id, 'user-a');
  assert.doesNotMatch(JSON.stringify(h.controller.getSnapshot()), /correct|password/);
});

test('local deadline closes the session even without another business request', async () => {
  const h = harness(async () => h.session());
  await h.controller.refresh();
  h.advance(60_001);
  assert.equal(h.controller.getSnapshot().status, 'anonymous');
  assert.equal(h.controller.getSnapshot().session, undefined);
  assert.match(h.controller.getSnapshot().message, /过期/);
});

test('explicit logout closes business immediately, failure is honest, and a late session response cannot restore access', async () => {
  const pendingSession = deferred(); const logout = deferred(); let readCount = 0;
  const h = harness(async route => route === 'POST:/auth/logout' ? logout.promise : ++readCount === 1 ? h.session() : pendingSession.promise);
  await h.controller.refresh();
  const late = h.controller.refresh();
  const leave = h.controller.logout();
  assert.equal(h.controller.getSnapshot().status, 'anonymous');
  assert.equal(h.controller.getSnapshot().busy, true);
  pendingSession.resolve(h.session()); await late;
  assert.equal(h.controller.getSnapshot().status, 'anonymous');
  logout.reject(Error('network lost')); await leave;
  assert.equal(h.controller.getSnapshot().logoutFailed, true);
  assert.match(h.controller.getSnapshot().error, /可能仍有效/);
});

test('Strict Mode cleanup cannot strand the login gate behind an abandoned session request', async () => {
  const abandoned = deferred(); let calls = 0;
  const h = harness(async () => ++calls === 1 ? abandoned.promise : h.session());
  const stop = h.controller.start(); stop();
  const finish = h.controller.start(); await h.controller.refresh();
  assert.equal(h.controller.getSnapshot().status, 'authenticated');
  abandoned.resolve(h.session('old-user')); await abandoned.promise;
  await Promise.resolve();
  assert.equal(h.controller.getSnapshot().session.user.id, 'user-a');
  finish();
});
