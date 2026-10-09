import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

function load(path, require = () => { throw new Error('Unexpected dependency'); }) {
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021 } });
  const exports = {};
  runInNewContext(outputText, { exports, require });
  return exports;
}
const presentation = load('lib/presentation');
const { currentProjectChecks } = load('lib/project-check-scope');

function controllerHarness() {
  const values = [], dependencies = [], requests = [];
  let cursor = 0, pending = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!dependencies[index] || deps.some((value, position) => !Object.is(value, dependencies[index][position]))) pending.push(effect); dependencies[index] = deps; },
  };
  const request = async (route, input) => { requests.push({ route, input }); return { id: 'saved-plan', version: input.version }; };
  const { useRelease } = load('hooks/use-release', name => name === 'react' ? react : name === '@/lib/api' ? { request } : presentation);
  return { requests, render(input) { let control; for (let pass = 0; pass < 5; pass++) { cursor = 0; pending = []; control = useRelease(input); if (!pending.length) return control; for (const effect of pending) effect(); } return control; } };
}
const input = nextVersion => ({ project: { id: 'project', nextVersion }, live: { source: { repo: 'repo', commit: 'fixed-commit' }, services: [{ serviceKey: 'api' }] }, location: { taskId: '', step: 1 }, navigate() {}, refresh() {} });

test('an untouched fresh version follows refreshed project allocation without overwriting manual input', () => {
  const harness = controllerHarness();
  assert.equal(harness.render(input('0.0.1')).version, '0.0.1');
  assert.equal(harness.render(input('0.0.2')).version, '0.0.2');
  harness.render(input('0.0.2')).setVersion('1.0.0');
  assert.equal(harness.render(input('0.0.3')).version, '1.0.0');
});

test('generated plans keep their reviewed version when the project next version advances', async () => {
  const harness = controllerHarness();
  await harness.render(input('0.0.1')).generatePlan();
  const reviewed = harness.render(input('0.0.2'));
  assert.equal(reviewed.version, '0.0.1');
  assert.equal(reviewed.plan.version, '0.0.1');
});

test('restored history remains read-only before detail arrives and after its saved plan is loaded', async () => {
  const harness = controllerHarness();
  const historical = { ...input('0.0.3'), location: { taskId: 'historical-task', step: 1 } };
  const loading = harness.render(historical);
  loading.setVersion('9.0.0');
  loading.toggle('api');
  await loading.generatePlan();
  await loading.start();
  const restored = harness.render({ ...historical, detail: { task: { id: 'historical-task', version: '0.0.1', status: 'succeeded' }, plan: { id: 'historical-plan', version: '0.0.1', selection: ['api'], sourceMode: 'git' } } });
  assert.equal(restored.readOnly, true);
  assert.equal(restored.version, '0.0.1');
  assert.equal(restored.plan.id, 'historical-plan');
  assert.equal(harness.requests.length, 0);
});

test('checks from a previous target or configuration scope cannot label the current project as checked', () => {
  const value = { live: { targetKey: 'prod' }, checks: [{ name: 'runtime', ok: true }] };
  const stored = { scope: 'project|config-a|prod', value };
  assert.equal(currentProjectChecks(stored, stored.scope, 'prod'), value);
  assert.equal(currentProjectChecks(stored, 'project|config-a|staging', 'staging'), null);
  assert.equal(currentProjectChecks(stored, 'project|config-b|prod', 'prod'), null);
  assert.equal(currentProjectChecks(stored, stored.scope, 'staging'), null);
});
