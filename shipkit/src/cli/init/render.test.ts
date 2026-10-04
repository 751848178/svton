// Masking regression (M1-01, audit cases A01/A11): the FINAL renderReview
// output — not the masking helper — must never contain old or new tokens,
// regardless of diff prefixes, flow-style/JSON configs, block scalars or
// unparsable existing files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReview } from './render.js';
import { planFileWrites } from './write.js';
import { baseAnswers, freshProject } from './wizard-fixtures.js';

const OLD = 'AUDIT_OLD_BUILDER';
const NEW = 'AUDIT_NEW_BUILDER';

test('A01: updating an existing config never shows old or new tokens in the review', async () => {
  const dir = await freshProject({
    'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
    'ship.config.yaml': [
      'builder:', '  mode: static', '  static:', '    url: http://old-builder.example.com', `    token: ${OLD}`,
      'registry:', '  url: registry.example.com', '  namespace: audit',
      'runtime:', '  targets:', '    staging:', '      url: http://old-builder.example.com', '      token: AUDIT_OLD_RUNTIME',
    ].join('\n') + '\n',
  });
  const answers = baseAnswers({ builderToken: NEW });
  const plan = planFileWrites(dir, answers);
  const review = renderReview(answers, plan, null, null, null);

  assert.ok(!review.includes(OLD), `old token leaked:\n${review}`);
  assert.ok(!review.includes(NEW), `new token leaked:\n${review}`);
  assert.ok(!review.includes('AUDIT_OLD_RUNTIME'), `runtime token leaked:\n${review}`);
  assert.ok(review.includes('********'), 'masked placeholders must still be visible');
  assert.ok(review.includes('token'), 'the diff itself must remain reviewable');
});

test('A01b: a change that is fully masked renders as an explicit note, not an empty diff', async () => {
  const dir = await freshProject({
    'ship.config.yaml': [
      'builder:', '  mode: static', '  static:', '    url: http://127.0.0.1:7410', `    token: ${OLD}`,
      'registry:', '  url: registry.example.com', '  namespace: audit',
      'runtime:', '  targets:', '    staging:', '      url: http://127.0.0.1:7410', '      token: AUDIT_OLD_RUNTIME',
    ].join('\n') + '\n',
  });
  const answers = baseAnswers({ builderToken: NEW }); // only the token differs
  const review = renderReview(answers, planFileWrites(dir, answers), null, null, null);
  assert.ok(!review.includes(OLD) && !review.includes(NEW), review);
  assert.ok(review.includes('差异仅涉及'), `a masked-only change must be explained: ${review}`);
});

test('A11: multi-line (block scalar) tokens are fully masked', async () => {
  const dir = await freshProject();
  const answers = baseAnswers({ builderToken: 'AUDIT_FIRST_LINE\nAUDIT_SECOND_LINE' });
  const review = renderReview(answers, planFileWrites(dir, answers), null, null, null);
  assert.ok(!review.includes('AUDIT_FIRST_LINE'), review);
  assert.ok(!review.includes('AUDIT_SECOND_LINE'), `second block-scalar line leaked:\n${review}`);
});

test('flow-style YAML and JSON configs are masked too (object-level, not line-level)', async () => {
  const jsonDir = await freshProject({
    'ship.config.json': JSON.stringify({
      builder: { mode: 'static', static: { url: 'http://127.0.0.1:7410', token: OLD } },
      runtime: { targets: { staging: { url: 'http://127.0.0.1:7410', token: 'AUDIT_OLD_RUNTIME' } } },
    }),
  });
  const answers = baseAnswers({ builderToken: NEW });
  const jsonReview = renderReview(answers, planFileWrites(jsonDir, answers, { configPath: `${jsonDir}/ship.config.json` }), null, null, null);
  assert.ok(!jsonReview.includes(OLD) && !jsonReview.includes(NEW) && !jsonReview.includes('AUDIT_OLD_RUNTIME'), jsonReview);
});

test('an unparsable existing config is never echoed raw in the review', async () => {
  const dir = await freshProject({
    'ship.config.yaml': `builder: [unclosed ${OLD}\n`,
  });
  const answers = baseAnswers();
  const plan = planFileWrites(dir, answers);
  const review = renderReview(answers, plan, null, null, null);
  assert.ok(!review.includes(OLD), `invalid raw content leaked:\n${review}`);
  assert.ok(review.includes('无法解析'), 'the user must be told the file cannot be parsed');
  assert.ok(review.includes('备份'), 'and that the original is backed up');
});
