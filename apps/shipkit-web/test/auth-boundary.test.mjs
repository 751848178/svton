import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const nativeRequire = createRequire(import.meta.url);
function load(path, require, globals = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require, URLSearchParams, AbortController, ...globals });
  return exports;
}
const anonymous = { status: 'anonymous', busy: false, error: '', message: '', logoutFailed: false, generation: 1 };
const user = { id: 'user', username: 'operator', displayName: '真实操作员' };

test('the real PlatformApp gate issues zero business queries before authentication', () => {
  let state = { ...anonymous, status: 'checking' }; const calls = [];
  const { AuthGate } = load('auth/auth-gate.tsx', name => {
    if (name === './use-auth-session') return { useAuthSession: () => ({ state, controller: { refresh() {}, login() {}, logout() {}, onInvalidate() {} } }) };
    if (name === './session-cache') return { SessionCache: Map };
    if (name === './login-page') return { LoginPage: () => createElement('div', null, '登录') };
    return nativeRequire(name);
  });
  const { PlatformApp } = load('components/platform-app.tsx', name => {
    if (name === '@/auth/auth-gate') return { AuthGate };
    if (name === '@/hooks/use-api') return { useApi: route => { calls.push(route); return {}; } };
    if (name === '@/hooks/use-navigation') return { useNavigation: () => ({ location: { view: 'projects' }, navigate() {} }) };
    if (name === '@/lib/presentation') return { isBusy: () => false };
    if (name.startsWith('./')) return new Proxy({}, { get: () => () => createElement('div') });
    return nativeRequire(name);
  });
  for (const status of ['checking', 'anonymous', 'unavailable']) {
    state = { ...anonymous, status };
    renderToStaticMarkup(createElement(PlatformApp));
    assert.equal(calls.length, 0);
  }
  state = { ...anonymous, status: 'authenticated', session: { user, expiresAt: '2026-10-10T00:00:00Z' } };
  renderToStaticMarkup(createElement(PlatformApp));
  assert.equal(calls.length, 3);
});

test('login uses password-manager fields without a registration path; user controls render real identity and logout', () => {
  const { LoginPage } = load('auth/login-page.tsx', nativeRequire);
  const html = renderToStaticMarkup(createElement(LoginPage, { state: anonymous, onLogin() {}, onRetryLogout() {} }));
  assert.match(html, /autoComplete="username"/);
  assert.match(html, /type="password"[^>]*autoComplete="current-password"/);
  assert.match(html, /联系平台管理员/);
  assert.doesNotMatch(html, /注册|localStorage|token/);
  const { UserControls } = load('auth/user-controls.tsx', nativeRequire);
  const controls = renderToStaticMarkup(createElement(UserControls, { user, onLogout() {} }));
  assert.match(controls, /真实操作员/); assert.match(controls, /operator/);
  assert.match(controls, /aria-label="退出登录"/);
});

test('same-origin API calls send cookies and only protected 401s invalidate the current session', { timeout: 1500 }, async () => {
  const requests = []; const invalidations = []; let epoch = 4; let reply;
  let reportHeaders;
  const { request } = load('lib/api.ts', name => {
    if (name === './api-registry') return {};
    if (name === '@/auth/session-events') return { authEpoch: () => epoch, notifyUnauthorized: value => { if (value === epoch) { invalidations.push(value); reportHeaders?.(); } }, trackProtectedRequest: () => () => {} };
    if (name === '@svton/api-client') return { ApiError: class extends Error { constructor(code, message) { super(message); this.code = code; } }, createApiClient: adapter => ({ apiAsync: (route, data) => adapter.request({ url: `/api${route.split(':').slice(1).join(':')}`, method: route.split(':')[0], data }) }) };
    return nativeRequire(name);
  }, { fetch: async (url, options) => { requests.push({ url, options }); return reply || { ok: false, status: 401, json: async () => ({ message: 'unauthorized' }) }; } });
  await assert.rejects(request('POST:/auth/login', { username: 'operator', password: 'wrong' }));
  await assert.rejects(request('GET:/auth/session', {}));
  await assert.rejects(request('POST:/auth/logout', {}));
  assert.equal(invalidations.length, 0);
  let bodyRelease;
  const headersReceived = new Promise(resolve => { reportHeaders = resolve; });
  reply = { ok: false, status: 401, json: () => new Promise(resolve => { bodyRelease = resolve; }) };
  const expired = request('GET:/projects', {});
  await headersReceived;
  assert.deepEqual(invalidations, [4]);
  bodyRelease({ message: 'expired' });
  await assert.rejects(expired);
  assert(requests.every(value => value.options.credentials === 'same-origin'));
  let release;
  reply = new Promise(resolve => { release = resolve; });
  const late = request('GET:/agents', {});
  epoch = 5;
  release({ ok: false, status: 401, json: async () => ({ message: 'expired old session' }) });
  await assert.rejects(late);
  assert.deepEqual(invalidations, [4]);
});
