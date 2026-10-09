import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const nativeRequire = createRequire(import.meta.url);
function load(path, require = nativeRequire) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require });
  return exports;
}
const presentation = load('lib/presentation.ts');
const { ConfigReference } = load('components/config-reference.tsx');
const { SourceReference } = load('components/source-reference.tsx');
const { HistoryInputs } = load('components/history-inputs.tsx', name => name === './config-reference' ? { ConfigReference } : name === './source-reference' ? { SourceReference } : nativeRequire(name));
const { RuntimeHistory } = load('components/runtime-history.tsx', name => name === '@/lib/presentation' ? presentation : name === './history-inputs' ? { HistoryInputs } : nativeRequire(name));
const failedTask = { id: 'failed-task', version: '9.9.9', remoteReleaseId: null };
const item = overrides => ({ releaseId: 'first-remote', parentReleaseId: null, targetSnapshotId: null, changedServices: ['backend'], createdAt: '2026-10-08T00:00:00Z', rollbackAvailable: false, ...overrides });
function render(record, tasks, current = record.releaseId) {
  return renderToStaticMarkup(createElement(RuntimeHistory, { history: { items: [record], current }, tasks, onTask() {}, onRollback() {} }));
}

test('a first deployment has no old snapshot and cannot match a failed task with a null remote ID', () => {
  const html = render(item({}), [failedTask], null);
  assert.match(html, /data-label="可恢复的旧快照">无旧快照/);
  assert.match(html, /当前 尚未部署/);
  assert.doesNotMatch(html, /9\.9\.9/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>选择服务回滚<\/button>/);
});

test('real remote IDs identify the corresponding task and recoverable old version', () => {
  const html = render(item({ releaseId: 'known-remote', parentReleaseId: 'previous-remote', rollbackAvailable: true }), [
    failedTask, { id: 'known-task', version: '1.0.0', remoteReleaseId: 'known-remote' }, { id: 'previous-task', version: '0.0.2', remoteReleaseId: 'previous-remote' },
  ]);
  assert.match(html, /当前 版本 1\.0\.0/);
  assert.match(html, /<button class="task-link">1\.0\.0<\/button>/);
  assert.match(html, /data-label="可恢复的旧快照">版本 0\.0\.2/);
  assert.doesNotMatch(html, /9\.9\.9/);
});

test('an unknown remote ID reports an unassociated task without inventing a platform version', () => {
  const html = render(item({ releaseId: 'outside-remote', parentReleaseId: 'outside-parent', rollbackAvailable: true }), [failedTask]);
  assert.match(html, /<strong>未关联任务<\/strong>/);
  assert.match(html, /当前 未关联变更/);
  assert.match(html, /data-label="可恢复的旧快照"><span class="mono">outside-parent<\/span>/);
  assert.doesNotMatch(html, /9\.9\.9/);
});

test('runtime history presents saved per-service config and source rather than newer project inputs', () => {
  const html = render(item({ services: { backend: { imageRef: 'repo@sha256:fixed', configRef: { mode: 'version', name: '生产配置', version: '1.2.3', versionId: 'frozen' }, source: { type: 'git', repo: 'https://git.example.com/old.git', ref: 'stable', sha: 'saved-sha' } }, admin: { imageRef: 'repo@sha256:old' } } }), []);
  assert.match(html, /生产配置 · 1\.2\.3/); assert.match(html, /saved-sha/); assert.match(html, /old\.git/);
  assert.match(html, /历史文件配置（未记录版本关联）/); assert.match(html, /此记录未保存源码来源/);
});
