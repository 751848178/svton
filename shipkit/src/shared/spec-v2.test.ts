// spec-v2 validation: v2 project specs, service fields, volume/network syntax,
// build slices, and the v1↔v2 boundary (spec-schema stays the v1 validator).

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectSpec, validateServiceSpec, buildSliceFor, parseVolumeMount, isProjectSpec } from './spec-v2.js';
import { validateSpec } from './spec-schema.js';

const BASE = {
  schemaVersion: 2,
  name: 'twgg',
  services: {
    backend: { dockerfile: 'apps/backend/Dockerfile', context: 'apps/backend', target: 'prod', ports: ['8080:8080'] },
    admin: { dockerfile: 'apps/admin/Dockerfile', context: '.', envFile: 'admin.env', networks: ['twgg-net'], volumes: ['twgg-uploads:/srv/uploads', '/srv/data:/data:ro'] },
  },
};

test('a full v2 project spec validates and round-trips its services', () => {
  const spec = validateProjectSpec(BASE);
  assert.equal(spec.name, 'twgg');
  assert.deepEqual(Object.keys(spec.services), ['backend', 'admin']);
  assert.equal(spec.services.backend?.target, 'prod');
  assert.equal(spec.services.admin?.envFile, 'admin.env');
  assert.deepEqual(spec.services.admin?.networks, ['twgg-net']);
});

test('v1 single-app specs stay on the v1 validator and are NOT project specs', () => {
  const v1 = validateSpec({ name: 'web', ports: ['3000:3000'] });
  assert.equal(v1.name, 'web');
  assert.equal(isProjectSpec(v1), false);
  assert.equal(isProjectSpec({ schemaVersion: 2 }), true);
});

test('unknown fields refuse at both project and service level', () => {
  assert.throws(() => validateProjectSpec({ ...BASE, extra: 1 }), /extra: unknown field/);
  assert.throws(() => validateProjectSpec({ ...BASE, services: { bad: { nope: true } } }), /services\.bad\.nope: unknown field/);
});

test('structural requirements: schemaVersion exactly 2, name regex, non-empty services, service name regex', () => {
  assert.throws(() => validateProjectSpec({ ...BASE, schemaVersion: 1 }), /schemaVersion/);
  assert.throws(() => validateProjectSpec({ ...BASE, name: 'BadName' }), /name/);
  assert.throws(() => validateProjectSpec({ schemaVersion: 2, name: 'g', services: {} }), /services/);
  assert.throws(() => validateProjectSpec({ schemaVersion: 2, name: 'g', services: { 'Bad': {} } }), /service name/);
});

test('port/buildArgs/healthcheck validation is shared with v1 (same errors)', () => {
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { ports: ['not-a-port'] } } }), /ports\[0\]/);
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { buildArgs: { SECRET_KEY: 'x' } } } }), /strict policy/);
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { healthcheck: { path: 'no-slash' } } } }), /healthcheck.path/);
});

test('platform must be linux/amd64 or linux/arm64; target must be whitespace-free', () => {
  validateProjectSpec({ ...BASE, services: { a: { platform: 'linux/amd64', target: 'prod-stage' } } });
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { platform: 'windows/amd64' } } }), /platform/);
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { target: 'two words' } } }), /target/);
});

test('volume mounts: named volumes, binds with :ro, and every malformed shape', () => {
  assert.deepEqual(parseVolumeMount('data:/var/lib/x', 'v'), { kind: 'volume', source: 'data', target: '/var/lib/x', readOnly: false });
  assert.deepEqual(parseVolumeMount('/host:/container:ro', 'v'), { kind: 'bind', source: '/host', target: '/container', readOnly: true });
  for (const bad of ['data', '/var/lib/x', 'rel/ative:/c', '/h:/c:rw', 'data:relative', 'data:/c/../escape', '.:/c', '..:/c']) {
    assert.throws(() => parseVolumeMount(bad, 'v'), /must be|path|volume name|third part/, `expected refusal: ${bad}`);
  }
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { volumes: ['x:/c', 'x:/c'] } } }), /duplicate/);
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { networks: ['net', 'net'] } } }), /duplicate network/);
});

test('network names follow docker rules (no leading dash/dot)', () => {
  validateProjectSpec({ ...BASE, services: { a: { networks: ['twgg-net', 'Net_2.x'] } } });
  assert.throws(() => validateProjectSpec({ ...BASE, services: { a: { networks: ['-bad'] } } }), /network name/);
});

test('validateServiceSpec revalidates stored snapshots with the same strictness', () => {
  assert.equal(validateServiceSpec('a', { target: 'prod' }).target, 'prod');
  assert.throws(() => validateServiceSpec('a', { ports: ['0:0'] }), /ports/);
});

test('buildSliceFor emits a v1-shaped spec with build-time fields only, defaulting the group platform', () => {
  const slice = buildSliceFor('backend', { target: 'prod', ports: ['1:1'], networks: ['n'], envFile: 'x.env' }, 'linux/amd64');
  assert.deepEqual(slice, { name: 'backend', target: 'prod', platform: 'linux/amd64' });
  validateSpec(slice); // the builder's /api/build validator accepts it
  const custom = buildSliceFor('a', { platform: 'linux/arm64' }, 'linux/amd64');
  assert.equal(custom.platform, 'linux/arm64', 'service platform wins over the group default');
});

test('image repository override changes the builder name while service and snapshot identities stay fixed', () => {
  const spec = validateProjectSpec({ schemaVersion: 2, name: 'shipkit', services: { server: { imageRepository: 'shipkit-server' } } });
  assert.deepEqual(Object.keys(spec.services), ['server']);
  assert.equal(spec.services.server?.imageRepository, 'shipkit-server');
  assert.deepEqual(validateServiceSpec('server', spec.services.server), { imageRepository: 'shipkit-server' });
  const slice = buildSliceFor('server', spec.services.server!, 'linux/amd64');
  assert.deepEqual(slice, { name: 'shipkit-server', platform: 'linux/amd64' });
  validateSpec(slice);
  assert.ok(!Object.hasOwn(slice, 'imageRepository'), 'existing Builder wire contract needs no new field');
  assert.ok(!Object.hasOwn(validateServiceSpec('server', {}), 'imageRepository'), 'omitted override stays absent');
});

test('image repositories must be restricted leaves; typo and present invalid values refuse', () => {
  const project = (imageRepository: unknown) => ({ schemaVersion: 2, name: 'g', services: { server: { imageRepository } } });
  for (const invalid of ['', 'ns/server', 'registry.example/server', '../server', 'server:tag', 'server@sha256:abc', '-server', 'Server', 'a'.repeat(64), null, undefined, 1, false, {}, []]) {
    assert.throws(() => validateProjectSpec(project(invalid)), /services\.server\.imageRepository/, `must reject ${String(invalid)}`);
  }
  assert.throws(() => validateServiceSpec('server', { imageRepo: 'shipkit-server' }), /unknown field/);
  assert.throws(() => validateSpec({ name: 'server', imageRepository: 'shipkit-server' }), /unknown field/, 'v1 wire shape remains unchanged');
});

test('effective image repositories are unique including aliases that collide with default service names', () => {
  const project = (services: unknown) => ({ schemaVersion: 2, name: 'g', services });
  assert.throws(() => validateProjectSpec(project({ a: { imageRepository: 'shared' }, b: { imageRepository: 'shared' } })), /effective repository 'shared'.*conflicts/);
  assert.throws(() => validateProjectSpec(project({ a: { imageRepository: 'b' }, b: {} })), /effective repository 'b'.*conflicts/);
  assert.doesNotThrow(() => validateProjectSpec(project({ a: { imageRepository: 'b' }, b: { imageRepository: 'a' } })));
});

test('dependencies cannot refer to undeclared prototype properties', () => {
  assert.throws(() => validateProjectSpec({ schemaVersion: 2, name: 'g', services: { api: { dependsOn: ['constructor'] } } }), /unknown service 'constructor'/);
});

test('explicitly declared constructor remains a valid service and dependency', () => {
  const spec = validateProjectSpec({ schemaVersion: 2, name: 'g', services: { api: { dependsOn: ['constructor'] }, constructor: {} } });
  assert.deepEqual(spec.services.api?.dependsOn, ['constructor']);
  assert.ok(Object.hasOwn(spec.services, 'constructor'));
});
