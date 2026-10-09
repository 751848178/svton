import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

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
