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
  const exports = {}; runInNewContext(outputText, { exports, require }); return exports;
}
const inputs = load('lib/release-inputs.ts');
const { ConfigReference } = load('components/config-reference.tsx');
const { SourceReference } = load('components/source-reference.tsx');
const { ReleaseInputEvidence } = load('components/release-input-evidence.tsx', name => name === '@/lib/release-inputs' ? inputs : name === './config-reference' ? { ConfigReference } : name === './source-reference' ? { SourceReference } : nativeRequire(name));
const sourceSnapshot = { repoUrl: 'https://git.example.com/new.git', requestedRef: { kind: 'tag', value: 'v1' }, commit: 'new-fixed', specPath: 'ship.yaml' };
const baseline = { type: 'git', repo: 'https://git.example.com/old.git', ref: 'stable', sha: 'old-fixed' };
const plan = overrides => ({ kind: 'release', selection: ['api'], detail: { sourceSnapshot, currentSources: { api: baseline, admin: baseline }, configBindings: { api: { mode: 'version', name: '生产配置', version: '1.0.0' }, admin: { mode: 'inherit', name: '旧配置', version: '0.0.1' } } }, ...overrides });
const actualRollback = JSON.parse(readFileSync(new URL('./fixtures/rollback-config-plan.json', import.meta.url), 'utf8'));

test('saved rollback configuration comes from the actual restored archived version, never generic bindings or newer refs', () => {
  assert.equal(actualRollback.detail.configBindings.api.mode, 'files');
  assert.equal(actualRollback.detail.currentConfigRefs.api.version, '0.0.3');
  assert.equal(inputs.planServiceConfig(actualRollback, 'api').version, '0.0.2');
  const missing = structuredClone(actualRollback); delete missing.detail.history.restoreServices.api.configRef;
  assert.equal(inputs.planServiceConfig(missing, 'api'), undefined);
  const unselected = structuredClone(actualRollback);
  unselected.detail.history.restoreServices.web.configRef.version = 'historical-web-must-not-apply';
  assert.equal(inputs.planServiceConfig(unselected, 'web').version, '0.0.0');
});

test('result evidence renders the actual archived rollback version and preserves saved unselected configuration', () => {
  const html = renderToStaticMarkup(createElement(ReleaseInputEvidence, { plan: actualRollback }));
  assert.match(html, /页面配置验收 · 0\.0\.2/);
  assert.match(html, /隔离 nginx 测试基线 · 0\.0\.0/);
  assert.doesNotMatch(html, /页面配置验收 · 0\.0\.3|历史文件配置/);
});

test('partial rollback restores selected sources and renders the saved current Git commit for unselected services', () => {
  const selectedSha = 'a'.repeat(40), currentWebSha = 'b'.repeat(40), parentWebSha = 'c'.repeat(40);
  const rollback = structuredClone(actualRollback);
  rollback.detail.currentSources = { api: { ...baseline, sha: 'd'.repeat(40) }, web: { ...baseline, sha: currentWebSha } };
  rollback.detail.history.restoreServices.api.source = { ...baseline, sha: selectedSha };
  rollback.detail.history.restoreServices.web.source = { ...baseline, sha: parentWebSha };
  assert.equal(inputs.planServiceSource(rollback, 'api').sha, selectedSha);
  assert.equal(inputs.planServiceSource(rollback, 'web').sha, currentWebSha);
  const html = renderToStaticMarkup(createElement(ReleaseInputEvidence, { plan: rollback }));
  assert(html.includes(selectedSha)); assert(html.includes(currentWebSha));
  assert(!html.includes(parentWebSha)); assert(!html.includes('d'.repeat(40)));
  assert.match(html, /恢复快照/); assert.match(html, /完整继承/);
  delete rollback.detail.currentSources.web;
  assert.equal(inputs.planServiceSource(rollback, 'web'), undefined);
  assert.match(renderToStaticMarkup(createElement(ReleaseInputEvidence, { plan: rollback })), /此记录未保存源码来源/);
  assert(!renderToStaticMarkup(createElement(ReleaseInputEvidence, { plan: rollback })).includes(parentWebSha));
});

test('a code release uses its verified commit for selected services and retains each inherited source', () => {
  const value = plan();
  assert.equal(inputs.planServiceSource(value, 'api').sha, 'new-fixed');
  assert.equal(inputs.planServiceSource(value, 'admin').sha, 'old-fixed');
  const html = renderToStaticMarkup(createElement(ReleaseInputEvidence, { plan: value }));
  assert.match(html, /生产配置 · 1\.0\.0/); assert.match(html, /继承 旧配置 · 0\.0\.1/);
  assert.match(html, /new-fixed/); assert.match(html, /old-fixed/); assert.match(html, /完整继承/);
});

test('config-only and rollback provenance cannot substitute a newer project source for saved inputs', () => {
  const configOnly = plan({ kind: 'config-only', detail: { currentSources: { api: baseline, admin: null }, configBindings: { api: { mode: 'version', name: '配置', version: '2.0.0' } } } });
  assert.equal(inputs.planServiceSource(configOnly, 'api').sha, 'old-fixed');
  const html = renderToStaticMarkup(createElement(ReleaseInputEvidence, { plan: configOnly }));
  assert.match(html, /不读取新的 Git 提交/); assert.doesNotMatch(html, /new-fixed/); assert.match(html, /此记录未保存源码来源/);
  const rollback = plan({ kind: 'rollback', detail: { history: { services: { api: { source: { ...baseline, sha: 'wrong-after-change' } } }, restoreServices: { api: { source: baseline, configRef: { mode: 'version', name: '旧配置', version: '0.0.1' } } } } } });
  assert.equal(inputs.planServiceSource(rollback, 'api').sha, 'old-fixed');
  assert.doesNotMatch(renderToStaticMarkup(createElement(ReleaseInputEvidence, { plan: rollback })), /wrong-after-change/);
});

test('a selected directory build without saved source proof does not pretend it has the current image source', () => {
  const value = plan({ detail: { currentSources: { api: baseline } } });
  assert.equal(inputs.planServiceSource(value, 'api'), undefined);
  assert.equal(inputs.planServiceSource({ ...value, detail: { ...value.detail, sourceDigest: 'fixed-tarball' }, sourceMode: 'directory' }, 'api').contentDigest, 'fixed-tarball');
});

test('version picker disables config-only inheritance, excludes archived versions, and verifies service coverage', () => {
  let options;
  const { ReleaseConfigPicker } = load('components/release-config-picker.tsx', name => {
    if (name === '@svton/ui') return { Select: props => { if (props.id === 'release-config-mode') options = props.options; return createElement('div', null, JSON.stringify(props.options)); } };
    if (name === '@/hooks/use-api') return { useApi: () => ({ data: { items: [{ id: 'archived', name: '不可选', version: '0.0.1', archivedAt: 'past', services: [] }, { id: 'partial', name: '缺少服务', version: '0.0.2', archivedAt: null, services: [] }, { id: 'covered', name: '完整覆盖', version: '0.0.3', archivedAt: null, services: [{ serviceKey: 'api' }] }] } }) };
    if (name === './config-store-error') return { ConfigStoreError: () => null };
    return nativeRequire(name);
  });
  const html = renderToStaticMarkup(createElement(ReleaseConfigPicker, { project: { id: 'repo', sourceKind: 'repository' }, targetKey: 'prod', first: false, control: { kind: 'config-only', configMode: 'version', configVersionId: '', selected: ['api'], openConfigs() {} } }));
  assert.equal(options.find(item => item.value === 'inherit').disabled, true);
  assert.equal(options.some(item => item.value === 'files'), false);
  assert.doesNotMatch(html, /不可选/); assert.match(html, /缺少所选服务配置/); assert.match(html, /完整覆盖/);
});

test('rollback plan review exposes only the saved restored source even without repository-wide source fields', () => {
  const presentation = load('lib/presentation.ts');
  const review = load('lib/release-review.ts');
  const { ConfigDifference } = load('components/config-difference.tsx');
  const { ReleasePlanView } = load('components/release-plan.tsx', name => {
    if (name === '@/lib/presentation') return presentation;
    if (name === '@/lib/release-review') return review;
    if (name === '@/lib/release-inputs') return inputs;
    if (name === './config-reference') return { ConfigReference };
    if (name === './source-reference') return { SourceReference };
    if (name === './config-difference') return { ConfigDifference };
    if (name === './image-reference') return { ImageReference: ({ value }) => createElement('span', null, value) };
    if (name === './command-copy') return { CommandCopy: () => null };
    return nativeRequire(name);
  });
  const rollback = plan({ kind: 'rollback', detail: { history: { services: { api: { imageRef: 'changed-image', source: { ...baseline, sha: 'wrong-after-change' } } }, restoreServices: { api: { imageRef: 'restore-image', source: baseline } } } } });
  const html = renderToStaticMarkup(createElement(ReleasePlanView, { plan: rollback, readOnly: true, project: {}, live: {}, onExecute() {} }));
  assert.match(html, /old-fixed/); assert.match(html, /restore-image/); assert.doesNotMatch(html, /wrong-after-change|changed-image/);
  assert.match(html, /恢复所选服务的历史配置快照/); assert.doesNotMatch(html, /使用已有环境文件/);
  const actual = renderToStaticMarkup(createElement(ReleasePlanView, { plan: actualRollback, readOnly: true, project: {},
    live: { services: [{ key: 'api', configRef: { mode: 'version', name: '最新运行配置', version: '9.9.9' } }] }, onExecute() {} }));
  assert.match(actual, /已保存的发布计划/); assert.match(actual, /页面配置验收 · 0\.0\.2/);
  assert.doesNotMatch(actual, /历史文件配置|页面配置验收 · 0\.0\.3|最新运行配置|9\.9\.9/);
});
