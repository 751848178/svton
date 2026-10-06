import { describe, expect, it } from 'vitest';
import { buildEnvironmentTargetComponentScope } from './settings-env-target-scope.model';

describe('buildEnvironmentTargetComponentScope', () => {
  it('keeps only active services in the selected environment and their persisted ports', () => {
    expect(
      buildEnvironmentTargetComponentScope(
        [
          {
            id: 'app-1',
            name: 'Picshare',
            services: [
              service('web', 'production', 'active', [3000, { containerPort: 8080 }]),
              service('worker', 'production', 'archived', [9000]),
              service('staging-web', 'staging', 'active', [3001]),
            ],
          },
        ],
        'production',
      ),
    ).toEqual([
      {
        serviceId: 'web',
        label: 'Picshare · web',
        ports: [3000, 8080],
      },
    ]);
  });
});

function service(id: string, environmentId: string, status: string, ports: unknown) {
  return {
    id,
    name: id,
    kind: 'web',
    ports,
    status,
    environment: { id: environmentId, key: environmentId, name: environmentId, status: 'active' },
  };
}
