import { describe, expect, it } from 'vitest';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import {
  stagingDeploymentFacts,
  stagingDeploymentStages,
  stagingProbeEvidence,
  stagingWorkloads,
} from './release-staging-deployment.model';

describe('release staging deployment model', () => {
  it('reads the frozen legacy params and only marks explicitly evidenced stages passed', () => {
    const run = fixture({
      params: {
        manifestId: 'manifest-1',
        manifestDigest: 'sha256:abc',
        deploymentProvider: { key: 'local-filesystem-v1', targetRef: 'filesystem-target' },
      },
      commandPlan: { steps: ['verify_manifest_digest', 'deploy_exact_manifest'] },
      result: {
        artifactVerified: true,
        providerActivated: true,
        providerDeploymentId: 'provider-run-1',
      },
    });

    expect(stagingDeploymentFacts(run)).toMatchObject({
      providerKey: 'local-filesystem-v1',
      targetRef: 'filesystem-target',
      manifestId: 'manifest-1',
      manifestDigest: 'sha256:abc',
    });
    expect(stagingDeploymentStages(run)).toEqual([
      {
        key: 'verify_manifest_digest',
        state: 'passed',
        evidence: ['result.artifactVerified=true'],
      },
      {
        key: 'deploy_exact_manifest',
        state: 'passed',
        evidence: ['result.providerActivated=true', 'result.providerDeploymentId=provider-run-1'],
      },
    ]);
  });

  it('does not turn a completed DeploymentRun into passing stage or probe evidence', () => {
    const run = fixture({
      status: 'completed',
      commandPlan: { steps: ['verify_manifest_digest', 'probe_workloads'] },
      result: {},
    });

    expect(stagingDeploymentStages(run).map((item) => item.state)).toEqual([
      'unavailable',
      'unavailable',
    ]);
    expect(stagingProbeEvidence(run)).toEqual([]);
  });

  it('reads target, workload and actual probe evidence from the frozen newer payload', () => {
    const run = fixture({
      params: {
        deploymentInput: {
          target: { serverId: 'server-1', bindingId: 'binding-1', providerKey: 'ssh-v1' },
          workload: {
            services: [
              {
                serviceId: 'service-1',
                componentKey: 'web',
                name: 'Web',
                kind: 'web',
                ports: [{ containerPort: 3000 }],
                executionMode: 'process',
              },
            ],
          },
        },
      },
      result: {
        workloadReady: { status: 'passed', checkedAt: '2026-08-10T11:00:00.000Z' },
        httpProbe: { status: 'not_configured', checkedServices: 0 },
      },
    });

    expect(stagingDeploymentFacts(run)).toMatchObject({
      serverId: 'server-1',
      bindingId: 'binding-1',
    });
    expect(stagingWorkloads(run)).toEqual([
      expect.objectContaining({ serviceId: 'service-1', componentKey: 'web' }),
    ]);
    expect(stagingProbeEvidence(run).map((item) => [item.key, item.status])).toEqual([
      ['workloadReady', 'passed'],
      ['httpProbe', 'not_configured'],
    ]);
  });
});

function fixture(
  overrides: Partial<ReleaseStagingDeploymentItem> = {},
): ReleaseStagingDeploymentItem {
  return {
    id: 'run-1',
    projectId: 'project-1',
    releaseOrderId: 'release-1',
    environmentId: 'staging-1',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    targetType: 'release-artifact',
    executorKey: 'release-artifact',
    adapterKey: 'local-filesystem-v1',
    dryRun: false,
    branch: 'master',
    commitSha: 'abc',
    logs: [],
    result: {},
    error: null,
    startedAt: '2026-08-10T11:00:00.000Z',
    finishedAt: '2026-08-10T11:00:01.000Z',
    createdAt: '2026-08-10T11:00:00.000Z',
    ...overrides,
  };
}
