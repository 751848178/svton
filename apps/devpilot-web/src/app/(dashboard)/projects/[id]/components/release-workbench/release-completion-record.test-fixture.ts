import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import type { ProductionValidationCheck } from './release-production-validation.model';

const validationKeys: ProductionValidationCheck['key'][] = [
  'artifactIntegrity',
  'environmentVersion',
  'workloadReady',
  'healthProbe',
  'entryProbe',
  'routeSwitch',
];

export function completionFixture() {
  const detail = {
    id: 'order-1',
    projectId: 'project-1',
    releaseVersion: '1.0.0',
    lifecycle: { status: 'succeeded' },
  } as ReleaseOrderDetail;
  const deployment = {
    id: 'deployment-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    releaseRunId: 'release-1',
    environmentId: 'production-env',
    artifactManifestId: 'manifest-1',
    source: 'release_order',
    dryRun: false,
    status: 'completed',
    finishedAt: '2026-08-28T00:02:00Z',
    createdAt: '2026-08-28T00:00:00Z',
    environment: { id: 'production-env', name: 'Production', baselineRole: 'production' },
    manifest: { id: 'manifest-1', digest: 'sha256:manifest' },
  } as NonNullable<ReleaseLifecycleEvidence['productionDeployment']>;
  const run = {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'production-env',
    artifactManifestId: 'manifest-1',
    status: 'succeeded',
    verifiedDigest: 'sha256:manifest',
    finishedAt: '2026-08-28T00:03:00Z',
    environment: { id: 'production-env', name: 'Production', baselineRole: 'production' },
    manifest: { id: 'manifest-1', digest: 'sha256:manifest' },
    deploymentRuns: [deployment],
  } as NonNullable<ReleaseLifecycleEvidence['productionRun']>;
  const validationChecks = validationKeys.map((key, index) => ({
    key,
    status: 'passed',
    label: 'passed',
    tone: 'success',
    checkedAt: index === 0 ? null : `2026-08-28T00:0${index}:00Z`,
    source: `source.${key}`,
  })) as ProductionValidationCheck[];
  const evidence: ReleaseLifecycleEvidence = {
    staging: 'passed',
    stagingProof: null,
    productionRun: run,
    productionDeployment: deployment,
    currentProductionVersion: {
      id: 'version-1',
      releaseOrderId: 'order-1',
      releaseVersion: '1.0.0',
      artifactManifestId: 'manifest-1',
      manifestDigest: 'sha256:manifest',
      deploymentRunId: 'deployment-1',
      effectiveAt: '2026-08-28T00:04:00Z',
    },
    production: 'passed',
    validation: 'passed',
    validationChecks,
    completed: true,
  };
  return { detail, evidence };
}
