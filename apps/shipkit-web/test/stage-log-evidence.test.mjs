import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => imports[name] || require(name) });
  return exports;
}
const presentation = load('lib/presentation.ts');
const primitives = load('components/primitives.tsx', { '@/lib/presentation': presentation, '@/lib/api': { errorText: String } });
const fields = load('lib/log-evidence-fields.ts');
const fieldComponent = load('components/log-evidence-fields.tsx', { './image-reference': { ImageReference: ({ value }) => createElement('span', { 'data-image-reference': value }, value) } });
const resultEvidence = load('components/stage-result-evidence.tsx', { '@/lib/log-evidence-fields': fields, '@/lib/presentation': presentation, './primitives': primitives, './log-evidence-fields': fieldComponent });
const remoteEvidence = load('components/remote-log-evidence.tsx', { '@/lib/log-remote-evidence': load('lib/log-remote-evidence.ts', { './presentation': presentation }), '@/lib/presentation': presentation, './primitives': primitives });
const { StageLogEvidence } = load('components/stage-log-evidence.tsx', {
  '@/lib/presentation': presentation,
  '@/lib/stage-log-activity': load('lib/stage-log-activity.ts'),
  '@/lib/task-state': load('lib/task-state.ts'),
  './primitives': primitives,
  '@/lib/log-evidence-fields': fields,
  './stage-result-evidence': resultEvidence,
  './remote-log-evidence': remoteEvidence,
});
function render(stages, service = '') {
  const detail = { task: {}, stages: stages.map(row => ({ stageKey: 'verify', status: 'succeeded', attempt: 1, updatedAt: '2026-10-08T12:30:00Z', ...row })), events: [], remoteJobs: [] };
  return renderToStaticMarkup(createElement(StageLogEvidence, { detail, stage: 'verify', service }));
}

test('real health-check shape keeps three service outcomes but counts only actual aggregate evidence', () => {
  const html = render([{ serviceKey: 'backend', detail: {} }, { serviceKey: 'admin', detail: {} }, { serviceKey: 'mobile', detail: {} }, { serviceKey: null, detail: { verification: 'passed' } }]);
  assert.ok(html.includes('阶段结果与检查证据'));
  assert.ok(html.includes('1 条结果'));
  assert.ok(html.includes('<dt>检查结果</dt><dd><span>检查通过</span>'));
  assert.ok(html.includes('&quot;verification&quot;: &quot;passed&quot;'));
  const activity = html.match(/<section class="log-activity"[\s\S]*?<\/section>/)[0];
  assert.equal((activity.match(/class="status good"/g) || []).length, 3);
  assert.equal((html.match(/<pre>/g) || []).length, 1);
  assert.ok(!html.includes('<pre>{}</pre>'));
  for (const service of ['backend', 'admin', 'mobile']) assert.ok(html.includes(`<span>${service}</span>`));
});
test('empty object, array and whitespace detail do not create evidence entries or hide terminal outcomes', () => {
  const html = render([{ serviceKey: 'backend', detail: {} }, { serviceKey: 'admin', detail: [] }, { serviceKey: 'mobile', detail: ' \n\t ' }, { serviceKey: null, detail: null }]);
  assert.ok(!html.includes('阶段结果与检查证据'));
  assert.ok(!html.includes('<details'));
  assert.equal((html.match(/class="status good"/g) || []).length, 3);
});
test('false and zero are valid evidence and retain their literal values', () => {
  const html = render([{ serviceKey: 'backend', detail: false }, { serviceKey: 'admin', detail: 0 }, { serviceKey: 'mobile', detail: ['probe'] }]);
  assert.ok(html.includes('3 条结果'));
  assert.ok(html.includes('<pre>false</pre>'));
  assert.ok(html.includes('<pre>0</pre>'));
  assert.equal((html.match(/<pre>/g) || []).length, 3);
});
test('build results have service, attempt, final state, timestamp and labelled fields before raw evidence', () => {
  const html = render([{ serviceKey: 'backend', attempt: 2, detail: { result: { tag: 'release-tag', arch: 'linux/amd64', localImage: 'shipbuild/backend:release-tag' } } }]);
  assert.ok(html.includes('<h4>backend</h4>'));
  assert.ok(html.includes('第 2 次'));
  assert.ok(html.includes('记录更新'));
  assert.ok(html.includes('<dt>镜像标签</dt>'));
  assert.ok(html.includes('<dt>镜像架构</dt>'));
  assert.ok(html.indexOf('<dt>镜像架构</dt>') < html.indexOf('原始结果数据（JSON）'));
});
test('remote task records and event categories express lifecycle versus polling distinctly', () => {
  const events = [{ seq: 1, type: 'remote-job', stageKey: 'build', serviceKey: 'backend', remoteJob: { jobId: 'job-a', logOffset: 120, eventOffset: 3 }, createdAt: '2026-10-08T12:30:00Z' }, { seq: 2, type: 'log', stageKey: 'build', serviceKey: 'backend', createdAt: '2026-10-08T12:30:01Z' }];
  const html = renderToStaticMarkup(createElement(remoteEvidence.RemoteLogEvidence, { jobs: [{ jobId: 'job-a', serviceKey: 'backend', stageKey: 'build', agentRole: 'builder', status: 'succeeded' }], events }));
  assert.ok(html.includes('<h4>backend</h4>'));
  assert.ok(html.includes('构建端'));
  assert.ok(html.includes('归档日志游标'));
  assert.ok(html.includes('120 字节'));
  assert.ok(html.includes('远端任务轮询'));
  assert.ok(html.includes('日志归档更新'));
  assert.ok(html.includes('已载入 2 条'));
  assert.ok(html.indexOf('归档日志游标') < html.indexOf('已载入原始事件数据（JSON）'));
});
