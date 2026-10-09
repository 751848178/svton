import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

function load(name) {
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021 } });
  const exports = {};
  runInNewContext(outputText, { exports });
  return exports;
}
const { stageState, cancellationBlocked, taskSummary } = load('task-state');
const { isBusy, requiresCleanup, releaseCommand } = load('presentation');
const { registrationInput, metadataInput } = load('project-input');

test('unfinished interrupted remote work blocks new navigation and releases', () => {
  assert.equal(isBusy({ status: 'interrupted', finishedAt: null }), true);
  assert.equal(isBusy({ status: 'interrupted', finishedAt: '2026-10-08T00:00:00Z' }), false);
  assert.equal(isBusy({ status: 'cancel-requested' }), true);
  assert.equal(isBusy({ status: 'succeeded', cleanupState: 'releasing' }), true);
});
test('normal running cleanup placeholders do not request manual recovery', () => {
  assert.equal(requiresCleanup({ status: 'running', cleanupState: 'pending' }), false);
  assert.equal(requiresCleanup({ status: 'interrupted', finishedAt: null, cleanupState: 'unknown' }), false);
  assert.equal(requiresCleanup({ status: 'failed', cleanupState: 'pending' }), true);
  assert.equal(requiresCleanup({ status: 'failed', cleanupState: 'failed' }), true);
  assert.equal(requiresCleanup({ status: 'succeeded', cleanupState: 'releasing' }), false);
});
test('service outcomes override initialized aggregate placeholder', () => {
  const stages = [{ stageKey: 'build', serviceKey: null, status: 'pending' }, { stageKey: 'build', serviceKey: 'api', status: 'succeeded' }];
  assert.equal(stageState(stages, 'build').status, 'succeeded');
  stages.push({ stageKey: 'build', serviceKey: 'web', status: 'failed' });
  assert.equal(stageState(stages, 'build').status, 'failed');
});
test('durable terminal aggregate closes older in-flight service rows without hiding failures or skipped probes', () => {
  const aggregate = { stageKey: 'verify', serviceKey: null, status: 'succeeded' };
  const probe = { stageKey: 'verify', serviceKey: 'api', status: 'running' };
  assert.equal(stageState([aggregate, probe], 'verify').status, 'succeeded');
  assert.equal(stageState([{ ...aggregate, status: 'skipped' }, probe], 'verify').status, 'skipped');
  assert.equal(stageState([aggregate, { ...probe, status: 'failed' }], 'verify').status, 'failed');
  assert.equal(stageState([aggregate, { ...probe, status: 'skipped' }], 'verify').status, 'skipped');
  assert.equal(stageState([probe], 'verify').status, 'running');
});
test('commit and acknowledged noncancellable phases cannot offer cancellation', () => {
  assert.equal(cancellationBlocked({ phase: 'deploy', cancelState: 'noncancellable' }), true);
  assert.equal(cancellationBlocked({ phase: 'commit', cancelState: 'available' }), true);
  assert.equal(cancellationBlocked({ phase: 'build', cancelState: 'available' }), false);
});
test('a successful cleanup retry supersedes the failed earlier attempt', () => {
  const stages = [{ stageKey: 'cleanup', attempt: 1, status: 'failed' }, { stageKey: 'cleanup', attempt: 2, status: 'succeeded' }];
  assert.equal(stageState(stages, 'cleanup').status, 'succeeded');
});
test('cleanup failure and recovery failure remain separate from healthy success', () => {
  assert.equal(taskSummary({ status: 'succeeded', cleanupState: 'failed', recoveryState: 'none' }).variant, 'warning');
  assert.equal(taskSummary({ status: 'failed', cleanupState: 'released', recoveryState: 'failed' }).variant, 'error');
});
test('copied CLI command uses real target flag and shell-quotes references', () => {
  const command = releaseCommand({ rootPath: '/tmp/project x', configPath: '/tmp/config.yaml', targetKey: 'local' }, ['api']);
  assert.ok(command.includes("--to 'local'"));
  assert.ok(command.includes("cd '/tmp/project x'"));
  assert.ok(!command.includes('--target'));
});
test('optional registration inputs are omitted and metadata clearing is explicit', () => {
  const register = JSON.parse(JSON.stringify(registrationInput({ name: 'local', rootPath: '/tmp/local', configPath: '/tmp/config.yaml', targetKey: '', serverName: '' })));
  assert.equal(Object.hasOwn(register, 'targetKey'), false);
  assert.equal(Object.hasOwn(register, 'serverName'), false);
  const metadata = metadataInput({ name: 'local', serverName: '', targetKey: 'local', services: [{ serviceKey: 'api', displayName: '', entryUrl: '' }] });
  assert.equal(metadata.serverName, null);
  assert.equal(metadata.services[0].entryUrl, null);
});
