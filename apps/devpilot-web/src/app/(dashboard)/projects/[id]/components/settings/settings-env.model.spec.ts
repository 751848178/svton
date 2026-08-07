import { describe, expect, it } from 'vitest';
import {
  environmentIdentityLabelKey,
  isBaselineEnvironment,
  isGovernedEnvironmentSet,
} from './settings-env.model';

describe('settings-env.model F444 identity helpers', () => {
  it('locks identity on any DeploymentRun, matching the server rule', () => {
    expect(environmentIdentityLabelKey({ identityLockedAt: null, _count: { deploymentRuns: 1 } }))
      .toBe('envIdentityLocked');
    expect(environmentIdentityLabelKey({ identityLockedAt: null, _count: { deploymentRuns: 0 } }))
      .toBe('envIdentityUnlocked');
    expect(environmentIdentityLabelKey({ identityLockedAt: '2026-07-01T00:00:00Z', _count: { deploymentRuns: 0 } }))
      .toBe('envIdentityLocked');
  });

  it('detects governed projects by active Staging + Production baselines', () => {
    const governed = [
      { baselineRole: 'staging', status: 'active' },
      { baselineRole: 'production', status: 'active' },
    ];
    expect(isGovernedEnvironmentSet(governed)).toBe(true);
    expect(isGovernedEnvironmentSet([governed[0]])).toBe(false);
    expect(isGovernedEnvironmentSet([
      { baselineRole: 'staging', status: 'active' },
      { baselineRole: 'production', status: 'archived' },
    ])).toBe(false);
  });

  it('classifies Staging/Production as baseline environments', () => {
    expect(isBaselineEnvironment({ baselineRole: 'staging' })).toBe(true);
    expect(isBaselineEnvironment({ baselineRole: 'production' })).toBe(true);
    expect(isBaselineEnvironment({ baselineRole: null })).toBe(false);
    expect(isBaselineEnvironment({})).toBe(false);
  });
});
