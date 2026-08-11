import type { ReleaseDeploymentTargetReadiness } from '../types/release-gate.types';
import { environmentVersionTargetReadiness } from './environment-version-target-readiness.model';

describe('environmentVersionTargetReadiness', () => {
  it.each([
    ['TARGET_READY', 'ready', true],
    ['TARGET_MISSING', 'missing', false],
    ['TARGET_DUPLICATED', 'duplicated', false],
    ['PROVIDER_MISMATCH', 'provider_mismatch', false],
    ['SSH_ROOT_INVALID', 'ssh_root_invalid', false],
    ['SSH_CONNECTION_INVALID', 'ssh_connection_invalid', false],
  ] as const)('maps %s to the %s state', (reasonCode, matchState, ready) => {
    const result = environmentVersionTargetReadiness(
      { reasonCode, matchState } as ReleaseDeploymentTargetReadiness,
      'Production',
      'zh-CN',
    );

    expect(result.ready).toBe(ready);
    if (ready) expect(result.reason).toBe('');
    else expect(result.reason).toMatch(/\S/);
  });
});
