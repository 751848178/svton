import { describe, expect, it } from 'vitest';
import { buildSettingsRouteTargetOptions } from './settings-route-target-options.model';

describe('buildSettingsRouteTargetOptions', () => {
  it('uses only active services and persisted ports in the selected environment', () => {
    const options = buildSettingsRouteTargetOptions([{
      id: 'app-1', name: 'Picshare', services: [
        { id: 'web', name: 'frontend', kind: 'container', status: 'active', ports: [4173], environment: { id: 'staging', key: 'staging', name: 'Staging', status: 'active' } },
        { id: 'api', name: 'backend', kind: 'container', status: 'active', deployConfig: { ports: ['4310:4310'] }, environment: { id: 'staging', key: 'staging', name: 'Staging', status: 'active' } },
        { id: 'other', name: 'other', kind: 'container', status: 'active', ports: [8080], environment: { id: 'production', key: 'production', name: 'Production', status: 'active' } },
      ],
    }], 'staging');

    expect(options).toEqual([
      { serviceId: 'web', component: 'frontend', port: 4173 },
      { serviceId: 'api', component: 'backend', port: 4310 },
    ]);
  });

  it('returns no fabricated fallback when service evidence is absent', () => {
    expect(buildSettingsRouteTargetOptions([], 'staging')).toEqual([]);
  });
});
