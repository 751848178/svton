import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const nativeRequire = createRequire(import.meta.url);
function load(path, require) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require, URLSearchParams });
  return exports;
}
const presentation = load('lib/presentation.ts', nativeRequire);

test('global resource navigation drops project/task context and restores project task routes from history', () => {
  let params = new URLSearchParams('view=release&project=project-a&task=task-a&step=4');
  const destinations = [];
  const { useNavigation } = load('hooks/use-navigation.ts', () => ({ useRouter: () => ({ push: value => destinations.push(value) }), useSearchParams: () => params }));
  useNavigation().navigate({ view: 'agents' });
  assert.equal(destinations[0], '/?view=agents');
  params = new URLSearchParams('view=agents&project=stale&task=stale&step=4');
  assert.equal(useNavigation().location.projectId, '');
  assert.equal(useNavigation().location.taskId, '');
  useNavigation().navigate({ view: 'settings', projectId: 'project-b' });
  assert.equal(destinations[1], '/?view=settings&project=project-b');
  params = new URLSearchParams('view=release&project=project-a&task=task-a&step=4');
  assert.equal(useNavigation().location.taskId, 'task-a');
  assert.equal(useNavigation().location.step, 4);
});

test('Agent global page disables project status and historical task requests even with stale location IDs', () => {
  const calls = [];
  const { AuthenticatedPlatformApp } = load('components/platform-app.tsx', name => {
    if (name === '@/hooks/use-navigation') return { useNavigation: () => ({ location: { view: 'agents', projectId: 'stale', taskId: 'stale', step: 4 }, navigate() {} }) };
    if (name === '@/hooks/use-api') return { useApi: (...args) => { calls.push(args); return {}; } };
    if (name === '@/lib/presentation') return presentation;
    if (name === '@/auth/auth-gate') return { AuthGate: () => null };
    if (name.startsWith('./')) return new Proxy({}, { get: () => () => createElement('div') });
    return nativeRequire(name);
  });
  renderToStaticMarkup(createElement(AuthenticatedPlatformApp, { user: { id: 'user', username: 'tester', displayName: '测试用户' }, onLogout() {} }));
  assert.equal(calls.length, 3);
  assert(calls.every(([route]) => route === null));
  assert.equal(calls[1][2], 0);
});

test('resource navigation has its own category, correct active item and case-insensitive agent menu search', () => {
  const { WorkspaceShell } = load('components/workspace-shell.tsx', name => {
    if (name === 'react') return { useState: initial => [initial === '' ? 'agent' : initial, () => {}] };
    if (name === '@svton/ui') return { Drawer: () => null };
    if (name === '@/auth/user-controls') return { UserControls: () => null };
    return nativeRequire(name);
  });
  const html = renderToStaticMarkup(createElement(WorkspaceShell, { view: 'agents', busy: false, navigate() {} }));
  assert.match(html, /资源管理/);
  assert.match(html, /Agent 资源/);
  assert.doesNotMatch(html, /项目管理/);
  assert.match(html, /class="nav-item active"[^>]*aria-current="page"/);
});

test('unchecked resources report unknown state and checked details separate actual role from credential access', () => {
  const { AgentCheckDetails } = load('components/agent-check-details.tsx', name => {
    if (name === '@/lib/presentation') return presentation;
    if (name === './primitives') return { Status: ({ label }) => createElement('span', null, label) };
    return nativeRequire(name);
  });
  const resource = { id: 'resource', bindings: [{ id: 'binding', projectName: 'TWGG', targetKey: 'prod' }] };
  const unchecked = renderToStaticMarkup(createElement(AgentCheckDetails, { resource }));
  assert.match(unchecked, /尚未检查/);
  assert.doesNotMatch(unchecked, /关联可用/);
  const checked = renderToStaticMarkup(createElement(AgentCheckDetails, { resource, result: { status: 'failed', checkedAt: '2026-10-08T00:00:00Z', checks: [{ bindingId: 'binding', ok: false, machineRole: 'both', accessRole: 'builder', version: '0.5.0', docker: true, error: '用途不符' }] } }));
  assert.match(checked, /实际机器角色：运行与构建 · 凭据权限：构建/);
  assert.match(checked, /用途不符/);
});
