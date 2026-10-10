import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSpec, SpecError } from './spec-schema.js';
import { validateProjectSpec, buildSliceFor } from './spec-v2.js';
import { validateRuntimePolicy } from './runtime-policy.js';

const logging = { maxSizeMiB: 10, maxFiles: 3 };

function validateBoth(value: unknown): void {
  assert.throws(() => validateSpec({ name: 'server', runtime: { logging: value } }), SpecError);
  assert.throws(() => validateProjectSpec({ schemaVersion: 2, name: 'shipkit',
    services: { server: { runtime: { logging: value } } } }), SpecError);
}

test('bounded logging survives both spec boundaries while build slices exclude it', () => {
  for (const value of [logging, { maxSizeMiB: 1, maxFiles: 1 }, { maxSizeMiB: 100, maxFiles: 10 }]) {
    const single = validateSpec({ name: 'server', runtime: { logging: value } });
    const group = validateProjectSpec({ schemaVersion: 2, name: 'shipkit',
      services: { server: { runtime: { logging: value } } } });
    assert.deepEqual(single.runtime?.logging, value);
    assert.deepEqual(group.services.server?.runtime?.logging, value);
    assert.deepEqual(buildSliceFor('server', group.services.server!, 'linux/amd64'), { name: 'server', platform: 'linux/amd64' });
  }
});

test('logging input is normalized into an independent policy object', () => {
  const input = { maxSizeMiB: 10, maxFiles: 3 };
  const policy = validateRuntimePolicy({ logging: input });
  input.maxSizeMiB = 100;
  assert.deepEqual(policy.logging, logging);
});

test('logging rejects drivers, options, unbounded values and incomplete or wrong types', () => {
  for (const value of [null, false, [], 'json-file', {}, { maxSizeMiB: 10 }, { maxFiles: 3 },
    { ...logging, driver: 'json-file' }, { ...logging, driver: 'syslog' },
    { ...logging, options: { 'max-size': '-1' } }, { ...logging, maxSizeMiB: 0 },
    { ...logging, maxSizeMiB: 101 }, { ...logging, maxSizeMiB: 1.5 }, { ...logging, maxSizeMiB: '10m' },
    { ...logging, maxSizeMiB: Infinity }, { ...logging, maxSizeMiB: NaN },
    { ...logging, maxFiles: 0 }, { ...logging, maxFiles: 11 }, { ...logging, maxFiles: 1.5 },
    { ...logging, maxFiles: '3' }, { ...logging, maxFiles: true }, { ...logging, compress: true }]) {
    validateBoth(value);
  }
});

test('absent logging leaves the existing runtime contract unchanged', () => {
  assert.deepEqual(validateSpec({ name: 'server' }), { name: 'server' });
  assert.deepEqual(validateRuntimePolicy({}), {});
  assert.deepEqual(validateRuntimePolicy({ restartPolicy: 'on-failure:3' }), { restartPolicy: 'on-failure:3' });
});
