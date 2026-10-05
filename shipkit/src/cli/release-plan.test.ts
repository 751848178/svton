// release planning (MS-01): the plan projects the selection onto the runtime's
// committed truth; diverged-but-unselected specs refuse; env CONTENT never
// appears in a plan (only names and hasEnv flags).

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectSpec } from '../shared/spec-v2.js';
import type { GroupStateView } from '../shared/group-protocol.js';
import { buildReleasePlan, sameServiceSpec } from './release-plan.js';

const spec = validateProjectSpec({
  schemaVersion: 2,
  name: 'twgg',
  services: {
    backend: { dockerfile: 'apps/backend/Dockerfile', target: 'prod', envFile: 'backend.env' },
    admin: { dockerfile: 'apps/admin/Dockerfile', ports: ['8081:80'], healthcheck: { path: '/healthz', hostPort: 8081 } },
    mobile: { dockerfile: 'apps/mobile/Dockerfile' },
  },
});

const deployed: GroupStateView = {
  schemaVersion: 2,
  app: 'twgg',
  current: 'rel-1',
  services: {
    backend: { imageRef: 'reg/ns/backend@sha256:' + 'b'.repeat(64), hasEnv: true, spec: { dockerfile: 'apps/backend/Dockerfile', target: 'prod', envFile: 'backend.env' } },
    admin: { imageRef: 'reg/ns/admin@sha256:' + 'a'.repeat(64), hasEnv: false, spec: { dockerfile: 'apps/admin/Dockerfile', ports: ['8081:80'], healthcheck: { path: '/healthz', hostPort: 8081 } } },
    mobile: { imageRef: 'reg/ns/mobile@sha256:' + 'm'.repeat(64), hasEnv: false, spec: { dockerfile: 'apps/mobile/Dockerfile' } },
  },
};

test('partial selection plans build+deploy for the selected and inherit the committed refs for the rest', () => {
  const plan = buildReleasePlan({ spec, project: 'proj', env: 'prod', target: 'prod', selection: ['admin'], requested: ['admin'], state: deployed });
  assert.equal(plan.firstDeployment, false);
  assert.equal(plan.baseReleaseId, 'rel-1');
  assert.deepEqual(plan.selection, { requested: ['admin'], resolved: ['admin'], inherited: ['backend', 'mobile'] });
  assert.equal(plan.services.admin?.action, 'build+deploy');
  assert.equal(plan.services.admin?.target, undefined);
  assert.equal(plan.services.admin?.platform, 'linux/amd64');
  assert.equal(plan.services.backend?.action, 'inherit');
  assert.equal(plan.services.backend?.imageRef, 'reg/ns/backend@sha256:' + 'b'.repeat(64));
  assert.equal(plan.services.mobile?.action, 'inherit');
  assert.deepEqual(plan.constraints.requiredServices, ['backend', 'admin', 'mobile']);
});

test('plan contains NO env content — only the declared envFile NAME and hasEnv flags', () => {
  const plan = buildReleasePlan({ spec, project: 'p', env: 'e', target: 'e', selection: ['backend'], requested: ['backend'], state: deployed });
  const text = JSON.stringify(plan);
  assert.equal(plan.services.backend?.envFile, 'backend.env');
  assert.ok(!text.includes('SECRET'), 'no env values anywhere in the plan');
  assert.ok(!text.includes('PASSWORD'));
});

test('an unselected service whose spec CHANGED refuses the plan (no silent divergence)', () => {
  const changed = validateProjectSpec({
    schemaVersion: 2, name: 'twgg',
    services: {
      backend: { dockerfile: 'apps/backend/Dockerfile', target: 'prod', envFile: 'backend.env' },
      admin: { dockerfile: 'apps/admin/Dockerfile', ports: ['9090:80'] }, // port changed, NOT selected
      mobile: { dockerfile: 'apps/mobile/Dockerfile' },
    },
  });
  assert.throws(
    () => buildReleasePlan({ spec: changed, project: 'p', env: 'e', target: 'e', selection: ['backend'], requested: ['backend'], state: deployed }),
    /changes the spec of service\(s\) admin.*include them in --services/,
  );
});

test('first deployment with no committed state plans every service as build+deploy and requires full selection', () => {
  const fresh: GroupStateView = { schemaVersion: 2, app: 'twgg', current: null, services: {} };
  assert.throws(
    () => buildReleasePlan({ spec, project: 'p', env: 'e', target: 'e', selection: ['admin'], requested: ['admin'], state: fresh }),
    /first deployment.*missing required services: backend, mobile/,
  );
  const plan = buildReleasePlan({ spec, project: 'p', env: 'e', target: 'e', selection: ['backend', 'admin', 'mobile'], requested: null, state: fresh });
  assert.equal(plan.firstDeployment, true);
  assert.deepEqual(plan.selection.inherited, []);
  assert.ok(Object.values(plan.services).every((s) => s.action === 'build+deploy'));
});

test('a service running on the runtime but missing from the spec refuses (no silent drop)', () => {
  const withExtra: GroupStateView = { ...deployed, services: { ...deployed.services, ghost: { imageRef: 'reg/ns/ghost:1', hasEnv: false, spec: {} } } };
  assert.throws(
    () => buildReleasePlan({ spec, project: 'p', env: 'e', target: 'e', selection: ['admin'], requested: ['admin'], state: withExtra }),
    /ghost.*absent from ship.yaml/,
  );
});

test('R06: a declared service that is NEITHER selected nor inheritable refuses the plan before any build', () => {
  const specWithNew = validateProjectSpec({
    schemaVersion: 2, name: 'twgg',
    services: {
      backend: { dockerfile: 'apps/backend/Dockerfile', target: 'prod', envFile: 'backend.env' },
      admin: { dockerfile: 'apps/admin/Dockerfile', ports: ['8081:80'], healthcheck: { path: '/healthz', hostPort: 8081 } },
      mobile: { dockerfile: 'apps/mobile/Dockerfile' }, // NEW: never deployed, not selected
    },
  });
  // the committed combination predates mobile: backend+admin only
  const withoutMobile: GroupStateView = { ...deployed, services: { backend: deployed.services.backend!, admin: deployed.services.admin! } };
  assert.throws(
    () => buildReleasePlan({ spec: specWithNew, project: 'p', env: 'e', target: 'e', selection: ['admin'], requested: ['admin'], state: withoutMobile }),
    /mobile.*neither selected nor present in the committed combination.*add them to --services/s,
  );
  // selecting it too is fine
  const plan = buildReleasePlan({ spec: specWithNew, project: 'p', env: 'e', target: 'e', selection: ['admin', 'mobile'], requested: ['admin', 'mobile'], state: withoutMobile });
  assert.equal(plan.services.mobile?.action, 'build+deploy');
});

test('R05: --keep-env on a FIRST deployment refuses in the plan (nothing to keep)', () => {
  const fresh: GroupStateView = { schemaVersion: 2, app: 'twgg', current: null, services: {} };
  assert.throws(
    () => buildReleasePlan({ spec, project: 'p', env: 'e', target: 'e', selection: ['backend', 'admin', 'mobile'], requested: null, state: fresh, keepEnv: true }),
    /--keep-env cannot be used on a first deployment/,
  );
  assert.ok(buildReleasePlan({ spec, project: 'p', env: 'e', target: 'e', selection: ['backend', 'admin', 'mobile'], requested: null, state: fresh }) instanceof Object);
});

test('dependsOn: declared dependencies are validated by the spec and surfaced in plan constraints', () => {
  // same committed spec shapes as `deployed`, plus the declared dependency
  const withDeps = validateProjectSpec({
    schemaVersion: 2, name: 'twgg',
    services: {
      admin: { dockerfile: 'apps/admin/Dockerfile', ports: ['8081:80'], healthcheck: { path: '/healthz', hostPort: 8081 }, dependsOn: ['backend'] },
      backend: { dockerfile: 'apps/backend/Dockerfile', target: 'prod', envFile: 'backend.env' },
      mobile: { dockerfile: 'apps/mobile/Dockerfile' },
    },
  });
  const plan = buildReleasePlan({ spec: withDeps, project: 'p', env: 'e', target: 'e', selection: ['admin'], requested: ['admin'], state: deployed });
  assert.deepEqual(plan.constraints.declaredDependencies, { admin: ['backend'] });
  // unknown/self references refuse at spec validation time
  assert.throws(() => validateProjectSpec({ schemaVersion: 2, name: 'g', services: { a: { dependsOn: ['zzz'] } } }), /unknown service 'zzz'/);
  assert.throws(() => validateProjectSpec({ schemaVersion: 2, name: 'g', services: { a: { dependsOn: ['a'] } } }), /cannot depend on itself/);
});

test('sameServiceSpec ignores key order and list order', () => {
  assert.ok(sameServiceSpec({ ports: ['1:1', '2:2'], target: 'a' }, { target: 'a', ports: ['2:2', '1:1'] }));
  assert.ok(!sameServiceSpec({ ports: ['1:1'] }, { ports: ['2:2'] }));
});
