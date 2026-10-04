import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrompter } from './prompt.js';

test('non-interactive: a default is returned verbatim and never waits', async () => {
  const p = createPrompter(false);
  assert.equal(p.interactive, false);
  const answer = await p.ask({ field: 'name', label: '应用名称', default: 'demo-web' });
  assert.equal(answer, 'demo-web');
  assert.equal(p.missing().length, 0);
});

test('non-interactive: no default → immediate structured missing, empty answer', async () => {
  const p = createPrompter(false);
  const answer = await p.ask({ field: 'healthcheckPath', label: '健康检查路径' });
  assert.equal(answer, '');
  const missing = p.missing();
  assert.equal(missing.length, 1);
  assert.equal(missing[0]!.field, 'healthcheckPath');
  assert.ok(missing[0]!.reason.includes('非交互'));
});

test('non-interactive: multiple candidates list the choices in the reason', async () => {
  const p = createPrompter(false);
  await p.ask({
    field: 'dockerfile', label: '选择 Dockerfile',
    choices: [{ value: 'Dockerfile', label: 'Dockerfile' }, { value: 'api/Dockerfile', label: 'api/Dockerfile' }],
  });
  const missing = p.missing();
  assert.equal(missing.length, 1);
  assert.ok(missing[0]!.reason.includes('api/Dockerfile'), missing[0]!.reason);
  assert.ok(missing[0]!.reason.includes('多个候选'));
});

test('non-interactive: optional question without a default skips instead of blocking', async () => {
  const p = createPrompter(false);
  const answer = await p.ask({ field: 'envFile', label: '运行时环境变量文件', optional: true });
  assert.equal(answer, '');
  assert.equal(p.missing().length, 0, 'optional fields must not appear in the missing list');
});

test('non-interactive: missing accumulates across questions for a complete list', async () => {
  const p = createPrompter(false);
  await p.ask({ field: 'a', label: 'A', default: 'x' });
  await p.ask({ field: 'b', label: 'B' });
  await p.ask({ field: 'c', label: 'C' });
  assert.deepEqual(p.missing().map((m) => m.field), ['b', 'c']);
});
