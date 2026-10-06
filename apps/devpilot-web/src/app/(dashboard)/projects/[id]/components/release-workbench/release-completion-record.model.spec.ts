import { describe, expect, it } from 'vitest';
import { buildReleaseCompletionRecord } from './release-completion-record.model';
import { completionFixture } from './release-completion-record.test-fixture';

describe('buildReleaseCompletionRecord', () => {
  it('creates a record only from the exact completed evidence chain', () => {
    const fixture = completionFixture();
    const result = buildReleaseCompletionRecord(fixture.detail, fixture.evidence);
    expect(result.blockers).toEqual([]);
    expect(result.record).toMatchObject({
      releaseVersion: '1.0.0',
      releaseRun: { id: 'release-1' },
      deploymentRun: { id: 'deployment-1' },
      environmentVersion: { id: 'version-1' },
    });
    expect(result.record?.validationChecks[0]?.checkedAt).toBeNull();
  });

  it.each([
    [
      'completion boolean',
      (f: ReturnType<typeof completionFixture>) => (f.evidence.completed = false),
      'completionFlag',
    ],
    [
      'current version identity',
      (f: ReturnType<typeof completionFixture>) => {
        if (f.evidence.currentProductionVersion)
          f.evidence.currentProductionVersion.releaseVersion = '0.9.0';
      },
      'releaseIdentity',
    ],
    [
      'success timestamp',
      (f: ReturnType<typeof completionFixture>) => {
        if (f.evidence.productionRun) f.evidence.productionRun.finishedAt = null;
      },
      'timestamps',
    ],
    [
      'independent validation',
      (f: ReturnType<typeof completionFixture>) => {
        f.evidence.validationChecks[2]!.label = 'failed';
      },
      'validation',
    ],
  ])('fails closed when %s conflicts with completion', (_name, mutate, blocker) => {
    const fixture = completionFixture();
    mutate(fixture);
    const result = buildReleaseCompletionRecord(fixture.detail, fixture.evidence);
    expect(result.record).toBeNull();
    expect(result.blockers).toContain(blocker);
  });

  it('requires the explicit DeploymentRun and current EnvironmentVersion facts', () => {
    const fixture = completionFixture();
    fixture.evidence.productionDeployment = null;
    fixture.evidence.currentProductionVersion = null;
    const result = buildReleaseCompletionRecord(fixture.detail, fixture.evidence);
    expect(result.record).toBeNull();
    expect(result.blockers).toEqual(expect.arrayContaining(['deploymentRun', 'currentVersion']));
  });
});
