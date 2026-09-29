import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecError, validateSpec } from './spec-schema.js';

test('accepts minimal valid spec', () => {
  const spec = validateSpec({ name: 'demo-web' });
  assert.equal(spec.name, 'demo-web');
});

test('rejects non-mapping spec and bad names', () => {
  assert.throws(() => validateSpec('nope'), SpecError);
  assert.throws(() => validateSpec({ name: 'My App' }), SpecError);
  assert.throws(() => validateSpec({ name: '-lead-dash' }), SpecError);
});

test('ports must be host:container within range', () => {
  assert.throws(() => validateSpec({ name: 'a', ports: ['abc'] }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', ports: ['70000:80'] }), SpecError);
  assert.deepEqual(validateSpec({ name: 'a', ports: ['3000:3000'] }).ports, ['3000:3000']);
});

test('strict buildArgs whitelist mirrors devpilot policy', () => {
  assert.throws(() => validateSpec({ name: 'a', buildArgs: { SECRET_TOKEN: 'x' } }), SpecError);
  assert.equal(validateSpec({ name: 'a', buildArgs: { NEXT_PUBLIC_API: 'x' } }).buildArgs?.NEXT_PUBLIC_API, 'x');
  assert.equal(validateSpec({ name: 'a', buildArgsPolicy: 'open', buildArgs: { FOO: '1' } }).buildArgs?.FOO, '1');
});

test('paths must stay inside the repo', () => {
  assert.throws(() => validateSpec({ name: 'a', context: '../out' }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', dockerfile: '/etc/passwd' }), SpecError);
});

test('healthcheck path must be absolute with valid port/timeout', () => {
  assert.throws(() => validateSpec({ name: 'a', healthcheck: { path: 'health' } }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', healthcheck: { hostPort: 70000 } }), SpecError);
  const hc = validateSpec({ name: 'a', healthcheck: { path: '/health', hostPort: 3000, timeoutSeconds: 60 } }).healthcheck;
  assert.equal(hc?.hostPort, 3000);
});

test('F30: present-but-wrong-type fields are errors, not silently dropped', () => {
  assert.throws(() => validateSpec({ name: 'a', context: 42 }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', ports: '3000' }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', healthcheck: { hostPort: '3000' } }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', healthcheck: { hostPort: 1.5 } }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', buildArgsPolicy: 'loose' }), SpecError);
});

test('F30: unknown fields are rejected instead of ignored', () => {
  assert.throws(() => validateSpec({ name: 'a', healtcheck: { path: '/x' } }), SpecError);
  assert.throws(() => validateSpec({ name: 'a', port: ['3000'] }), SpecError);
});
