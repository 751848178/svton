import test from 'node:test';
import assert from 'node:assert/strict';
import { unifiedDiff } from './diff.js';

test('identical content produces no diff', () => {
  assert.equal(unifiedDiff('a\nb\n', 'a\nb\n', 'x', 'y'), '');
});

test('additions, removals and context windows are marked', () => {
  const before = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8'].join('\n');
  const after = ['l1', 'l2', 'l3X', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'].join('\n');
  const diff = unifiedDiff(before, after, 'before', 'after');
  assert.ok(diff.includes('--- before'));
  assert.ok(diff.includes('+++ after'));
  assert.ok(diff.includes('- l3'));
  assert.ok(diff.includes('+ l3X'));
  assert.ok(diff.includes('+ l9'));
});

test('long unchanged stretches are collapsed', () => {
  const before = Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n');
  const after = Array.from({ length: 40 }, (_, i) => (i === 35 ? 'CHANGED' : `l${i}`)).join('\n');
  const diff = unifiedDiff(before, after, 'a', 'b');
  assert.ok(!diff.includes(' l5\n'), 'distant context must be collapsed');
  assert.ok(diff.includes('- l35'));
  assert.ok(diff.includes('+ CHANGED'));
});
