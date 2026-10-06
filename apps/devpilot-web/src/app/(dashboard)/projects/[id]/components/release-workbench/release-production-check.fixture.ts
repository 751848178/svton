import type { ProductionReleasePreview } from '../../types/release-production.types';
import type { ReleaseBuildItem } from '../../types/release-order.types';

export function productionCheckBuild() {
  return { manifest: { id: 'manifest-1', digest: 'sha256:manifest' } } as ReleaseBuildItem;
}

export function productionCheckPreview(): ProductionReleasePreview {
  return {
    inputHash: 'preview-hash',
    snapshot: {
      version: 2,
      projectId: 'project-1',
      releaseOrder: { id: 'order-1', releaseVersion: '1.0.0' },
      environment: {
        id: 'production-1',
        key: 'production',
        name: 'Production',
        baselineRole: 'production',
      },
      build: { id: 'build-1', revision: 1, sourceBranch: 'main', sourceCommitSha: 'commit-1' },
      manifest: { id: 'manifest-1', digest: 'sha256:manifest' },
      stagingProof: {
        deploymentRunId: 'staging-1',
        environmentId: 'staging-1',
        finishedAt: '2026-08-28T01:00:00.000Z',
      },
      config: {
        revisionId: 'config-1',
        revision: 2,
        snapshotHash: 'config-hash',
        resourceSnapshot: {},
        policySnapshot: {},
        observabilitySnapshot: {},
        routeSnapshot: {
          entries: [
            {
              domain: 'api.example.com',
              path: '/',
              serviceId: 'service-1',
              component: 'component-api',
              port: 3000,
              tlsMode: 'managed_cert',
            },
          ],
        },
      },
      releasePolicy: {
        revisionId: null,
        revision: 1,
        strategy: 'standard',
        requireProductionApproval: true,
        snapshotHash: 'policy-hash',
        synthetic: true,
      },
      workload: {
        inputHash: 'workload-hash',
        services: [
          { serviceId: 'service-1', componentKey: 'component-api', stateHash: 'state-hash' },
        ],
      },
    },
    preflight: {
      decision: {
        previewOnly: true,
        checkpoint: 'production_pre_execution',
        allowed: false,
        preApprovalAllowed: false,
        preApprovalBlockerGateIds: ['D01'],
        preApprovalManualGateIds: [],
        blockerGateIds: ['D01'],
        manualGateIds: [],
        integrityErrors: [],
      },
      checks: [
        {
          id: 'D01',
          title: { zh: '目标', en: 'Target' },
          status: 'blocked',
          reasonCode: 'target_missing',
          reason: { zh: '目标缺失', en: 'Target missing' },
          providerKey: 'provider',
          evidenceRef: 'config:1',
          checkedAt: '2026-08-28T01:00:00.000Z',
          expiresAt: null,
          fresh: true,
          repairHref: '/repair',
          localOnly: false,
          deferredUntilApproval: false,
        },
        {
          id: 'D13',
          title: { zh: '审批', en: 'Approval' },
          status: 'unavailable',
          reasonCode: 'approval_missing',
          reason: { zh: '等待审批', en: 'Awaiting approval' },
          providerKey: null,
          evidenceRef: null,
          checkedAt: null,
          expiresAt: null,
          fresh: null,
          localOnly: false,
          deferredUntilApproval: true,
        },
      ],
      acceptanceOnly: false,
      readiness: 'blocked',
      repairHref: '/repair',
      frozen: {
        deploymentInputHash: 'deploy-hash',
        workloadInputHash: 'workload-hash',
        workloadServiceCount: 1,
        workloadHealthConfigured: true,
      },
      concurrency: {
        limit: 1,
        state: 'occupied',
        checkedAt: '2026-08-28T01:00:00.000Z',
        activeRun: {
          id: 'run-2',
          releaseOrderId: 'order-2',
          releaseVersion: '2.0.0',
          mode: 'standard',
          status: 'running',
          createdAt: '2026-08-28T00:00:00.000Z',
        },
      },
    },
  };
}
