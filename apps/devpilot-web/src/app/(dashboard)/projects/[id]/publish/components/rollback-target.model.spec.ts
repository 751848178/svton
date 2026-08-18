import { describe, expect, it } from 'vitest';
import { resolveRollbackTarget } from './rollback-target.model';
import type { EnvironmentVersionsResponse } from '../../types/environment-version.types';
import { versionItem } from './release-progress.model.spec-fixtures';

describe('resolveRollbackTarget', () => {
  it('resolves previous production version as rollback target', () => {
    const versions = {
      environments: [
        {
          id: 'env-prod',
          key: 'production',
          name: '生产环境',
          baselineRole: 'production',
          currentEnvironmentVersionId: 'v2',
          targetReadiness: {},
          environmentVersions: [versionItem('v2', 'v1'), versionItem('v1', null)],
        },
      ],
      candidates: { staging: [], production: [] },
    } as unknown as EnvironmentVersionsResponse;
    expect(resolveRollbackTarget(versions)).toEqual({
      environmentId: 'env-prod',
      currentVersionId: 'v2',
      previousVersionId: 'v1',
    });
  });

  it('returns null without a previous version', () => {
    expect(resolveRollbackTarget(null)).toBeNull();
    expect(
      resolveRollbackTarget({ environments: [], candidates: { staging: [], production: [] } }),
    ).toBeNull();
  });

  it('M7: ignores staging-only history — rollback is per-environment (production only)', () => {
    const versions = {
      environments: [
        {
          id: 'env-staging',
          key: 'staging',
          name: '预发环境',
          baselineRole: 'staging',
          currentEnvironmentVersionId: 's2',
          targetReadiness: {},
          environmentVersions: [versionItem('s2', 's1'), versionItem('s1', null)],
        },
      ],
      candidates: { staging: [], production: [] },
    } as unknown as EnvironmentVersionsResponse;
    expect(resolveRollbackTarget(versions)).toBeNull();
  });

  it('M7: production environment without a current version has no rollback target', () => {
    const versions = {
      environments: [
        {
          id: 'env-prod',
          key: 'production',
          name: '生产环境',
          baselineRole: 'production',
          currentEnvironmentVersionId: null,
          targetReadiness: {},
          environmentVersions: [versionItem('v1', null)],
        },
      ],
      candidates: { staging: [], production: [] },
    } as unknown as EnvironmentVersionsResponse;
    expect(resolveRollbackTarget(versions)).toBeNull();
  });
});
