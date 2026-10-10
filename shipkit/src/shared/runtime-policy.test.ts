import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSpec, SpecError } from './spec-schema.js';
import { validateProjectSpec, buildSliceFor } from './spec-v2.js';
import { validateRuntimePolicy } from './runtime-policy.js';

const mount = { target: '/tmp', sizeMiB: 128, uid: 10001, gid: 10001, mode: '1777' };
const runtime = { restartPolicy: 'on-failure:3', readOnlyRoot: true, dropCapabilities: ['ALL'], noNewPrivileges: true,
  stopGracePeriodSeconds: 45, tmpfs: [mount, { ...mount, target: '/app/apps/web/.next/cache', mode: '0700', sizeMiB: 64 }] };

function both(input: unknown): void {
  for (const validate of [
    () => validateSpec({ name: 'server', runtime: input }),
    () => validateProjectSpec({ schemaVersion: 2, name: 'shipkit', services: { server: { runtime: input } } }),
  ]) assert.throws(validate, SpecError);
}

test('v1 and v2 preserve identical restrictions; build slices omit runtime settings', () => {
  const single = validateSpec({ name: 'server', runtime });
  const project = validateProjectSpec({ schemaVersion: 2, name: 'shipkit', services: { server: { runtime } } });
  assert.deepEqual(single.runtime, runtime);
  assert.deepEqual(project.services.server?.runtime, runtime);
  assert.deepEqual(buildSliceFor('server', project.services.server!, 'linux/amd64'), { name: 'server', platform: 'linux/amd64' });
  runtime.tmpfs[0]!.uid = 10002;
  assert.equal(single.runtime?.tmpfs?.[0]?.uid, 10001, 'normalized policy owns its immutable snapshot inputs');
  runtime.tmpfs[0]!.uid = 10001;
});

test('unsafe grants, unknown settings and disabling restrictions refuse at both boundaries', () => {
  for (const value of [null, false, [], 'root', { privileged: true }, { user: 'root' }, { capAdd: ['SYS_ADMIN'] },
    { readOnlyRoot: false }, { readOnlyRoot: 'true' }, { noNewPrivileges: false }, { dropCapabilities: [] },
    { dropCapabilities: ['NET_ADMIN'] }, { dropCapabilities: ['ALL', 'NET_ADMIN'] }, { unknown: true },
    { stopGracePeriodSeconds: 0 }, { stopGracePeriodSeconds: 301 }, { stopGracePeriodSeconds: 1.5 },
    { stopGracePeriodSeconds: '45s' }, { tmpfs: 'anything' }, { tmpfs: Array(17).fill(mount) }]) both(value);
});

test('tmpfs allows only bounded non-root, normalized cache/temporary mounts', () => {
  for (const overrides of [
    { target: '/' }, { target: '/etc' }, { target: '/proc' }, { target: '/sys/fs' }, { target: '/dev/shm' },
    { target: '/app/../etc' }, { target: '/tmp//x' }, { target: '/tmp/' }, { target: '/tmp/./x' },
    { target: '/tmp:rw' }, { target: '/tmp\nprivileged: true' }, { target: '/tmp/$TARGET' },
    { uid: 0 }, { gid: 0 }, { uid: -1 }, { uid: 2147483648 }, { uid: '10001' },
    { sizeMiB: 0 }, { sizeMiB: 4097 }, { sizeMiB: 1.5 }, { mode: 1777 }, { mode: '4777' },
    { mode: '2777' }, { mode: '0777' }, { mode: '0600' }, { exec: true }, { sizeMiB: undefined },
  ]) both({ tmpfs: [{ ...mount, ...overrides }] });
  both({ tmpfs: [mount, mount] });
  both({ tmpfs: [mount, { ...mount, target: '/tmp/cache' }] });
  both({ tmpfs: [{ ...mount, target: '/tmp/cache' }, mount] });
});

test('v1 and v2 accept var tmp scratch paths without sending runtime settings to builders', () => {
  for (const targets of [
    ['/var/tmp'], ['/var/tmp/shipkit'], ['/var/tmp/shipkit/locks'],
    ['/tmp', '/var/tmp'], ['/var/tmp/locks', '/var/tmp/locks-extra'],
  ]) {
    const policy = { tmpfs: targets.map(target => ({ ...mount, target, sizeMiB: 16, mode: '0700' })) };
    const single = validateSpec({ name: 'server', runtime: policy });
    const project = validateProjectSpec({ schemaVersion: 2, name: 'shipkit', services: { server: { runtime: policy } } });
    assert.deepEqual(single.runtime, policy);
    assert.deepEqual(project.services.server?.runtime, policy);
    assert.deepEqual(buildSliceFor('server', project.services.server!, 'linux/amd64'), { name: 'server', platform: 'linux/amd64' });
  }
});

test('var tmp permission does not allow similar prefixes, protected paths or weaker mount restrictions', () => {
  for (const target of [
    '/var', '/var/lib', '/var/lib/shipkit', '/var/tmp-escape', '/var/tmpfile',
    '/var/tmp/../lib', '/var/tmp//locks', '/var/tmp/./locks', '/var/tmp/',
    '/var/tmp:rw', '/var/tmp/$TARGET', '/var/tmp\nprivileged: true',
  ]) both({ tmpfs: [{ ...mount, target }] });
  for (const overrides of [
    { uid: 0 }, { gid: 0 }, { sizeMiB: 0 }, { sizeMiB: 4097 },
    { mode: '0777' }, { mode: '4777' }, { mode: '0600' }, { exec: true },
  ]) both({ tmpfs: [{ ...mount, target: '/var/tmp', ...overrides }] });
});

test('var tmp scratch mounts reject duplicates and ancestor overlap in either order', () => {
  for (const targets of [
    ['/var/tmp', '/var/tmp'], ['/var/tmp', '/var/tmp/locks'],
    ['/var/tmp/locks', '/var/tmp'], ['/var/tmp/shipkit', '/var/tmp/shipkit/locks'],
    ['/var/tmp/shipkit/locks', '/var/tmp/shipkit'],
  ]) both({ tmpfs: targets.map(target => ({ ...mount, target })) });
});

test('absent runtime preserves the legacy contract; opt-in empty runtime adds no restrictions', () => {
  assert.deepEqual(validateSpec({ name: 'server' }), { name: 'server' });
  assert.deepEqual(validateRuntimePolicy({}), {});
});

test('v1 and v2 accept only the two restricted restart policies and omit them from builds', () => {
  for (const restartPolicy of ['no', 'on-failure:3'] as const) {
    const single = validateSpec({ name: 'server', runtime: { restartPolicy } });
    const project = validateProjectSpec({ schemaVersion: 2, name: 'shipkit', services: { server: { runtime: { restartPolicy } } } });
    assert.deepEqual(single.runtime, { restartPolicy });
    assert.deepEqual(project.services.server?.runtime, { restartPolicy });
    assert.deepEqual(buildSliceFor('server', project.services.server!, 'linux/amd64'), { name: 'server', platform: 'linux/amd64' });
  }
  for (const restartPolicy of ['always', 'unless-stopped', 'on-failure', 'on-failure:0', 'on-failure:4', ' no', 'no ', '', null, true, 3, ['no'], {}]) {
    both({ restartPolicy });
  }
});
