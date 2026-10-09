import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const source = readFileSync(new URL('../src/lib/release-review.ts', import.meta.url), 'utf8');
const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021 } });
const exports = {};
runInNewContext(outputText, { exports });
const { releaseReviewServices, releaseReviewSource } = exports;

test('archived release includes the saved service set and inherited immutable reference', () => {
  const rows = releaseReviewServices({ kind: 'release', selection: ['backend'], detail: {
    releasePlan: { services: { backend: { dockerfile: 'Dockerfile.backend', platform: 'linux/amd64' }, admin: { imageRef: 'repo/admin@sha256:historical', platform: 'linux/amd64' } } },
  } });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].detail, 'Dockerfile.backend · linux/amd64');
  assert.equal(rows[1].detail, 'repo/admin@sha256:historical');
  assert.equal(rows[1].selected, false);
});

test('rollback review restores only selected saved targets, not newer running images or an old change state', () => {
  const rows = releaseReviewServices({ kind: 'rollback', selection: ['admin'], detail: {
    history: { services: { admin: { imageRef: 'repo/admin@sha256:changed' }, backend: { imageRef: 'repo/backend@sha256:unselected' } }, restoreServices: { admin: { imageRef: 'repo/admin@sha256:restore' } } },
  } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].serviceKey, 'admin');
  assert.equal(rows[0].action, '恢复到目标快照');
  assert.equal(rows[0].detail, 'repo/admin@sha256:restore');
});

test('configuration-only review shows each saved reused image and keeps selected services distinct from inheritance', () => {
  const api = `registry.invalid/api@sha256:${'a'.repeat(64)}`;
  const web = `registry.invalid/web@sha256:${'b'.repeat(64)}`;
  const rows = releaseReviewServices({ kind: 'config-only', selection: ['api'], detail: { releasePlan: { constraints: { platform: 'linux/amd64' }, services: {
    api: { action: 'build+deploy', imageRef: api }, web: { action: 'inherit', imageRef: web },
  } } } });
  assert.equal(rows[0].action, '复用镜像，更新运行配置');
  assert.equal(rows[0].imageRef, api); assert.equal(rows[0].detail, api); assert.equal(rows[0].selected, true);
  assert.equal(rows[1].action, '继承基线版本');
  assert.equal(rows[1].imageRef, web); assert.equal(rows[1].selected, false);
  const missing = releaseReviewServices({ kind: 'config-only', selection: ['api'], detail: { releasePlan: { constraints: { platform: 'linux/amd64' }, services: { web: { imageRef: web } } } } });
  const selected = missing.find(row => row.selected);
  assert.equal(selected.imageRef, undefined); assert.equal(selected.detail, '原计划未记录复用镜像');
});

test('configuration-only plan view renders the selected digest through the image component', () => {
  const imageRef = `registry.invalid/api@sha256:${'a'.repeat(64)}`;
  const source = readFileSync(new URL('../src/components/release-plan.tsx', import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2021, jsx: JsxEmit.ReactJSX } });
  const nativeRequire = createRequire(import.meta.url), view = {};
  const require = name => {
    if (name === '@/lib/release-review') return exports;
    if (name === '@/lib/presentation') return { time: String };
    if (name === '@/lib/release-inputs') return { planServiceSource: () => undefined, planServiceConfig: () => undefined };
    if (name === './image-reference') return { ImageReference: ({ value }) => createElement('code', { 'data-image-reference': value }, value) };
    if (name.startsWith('./')) return new Proxy({}, { get: () => () => null });
    return nativeRequire(name);
  };
  runInNewContext(outputText, { exports: view, require });
  const plan = { kind: 'config-only', selection: ['api'], detail: { releasePlan: { services: { api: { imageRef } }, externalResources: { networks: [], volumes: [], binds: [] }, constraints: { specChangedButNotSelected: [] } } } };
  const html = renderToStaticMarkup(createElement(view.ReleasePlanView, { project: {}, live: {}, plan, readOnly: true, onExecute() {} }));
  assert.match(html, /复用镜像，更新运行配置/); assert(html.includes(`data-image-reference="${imageRef}"`));
  assert.doesNotMatch(html, /原计划未记录继承镜像|原计划未记录复用镜像/);
});

test('older incomplete plans disclose absent evidence without inventing a current live fallback', () => {
  const rows = releaseReviewServices({ kind: 'release', selection: ['removed-service'], detail: {} });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].serviceKey, 'removed-service');
  assert.equal(rows[0].detail, '原计划未记录构建配置');
  assert.equal(releaseReviewServices({ kind: 'rollback', selection: ['admin'], detail: {} })[0].detail, '原计划未记录目标镜像');
  assert.equal(releaseReviewSource({}), '原计划未记录源码来源');
  assert.equal(releaseReviewSource({ sourceMode: 'git' }), 'Git 已提交版本');
  assert.equal(releaseReviewSource({ sourceMode: 'directory' }), '本机目录快照');
});
