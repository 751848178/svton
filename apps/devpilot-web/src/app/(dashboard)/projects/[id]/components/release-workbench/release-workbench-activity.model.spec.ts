import { describe, expect, it } from 'vitest';
import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import {
  buildReleaseWorkbenchActivities,
  buildReleaseWorkbenchActivityGroups,
} from './release-workbench-activity.model';

describe('buildReleaseWorkbenchActivities', () => {
  it('merges real release evidence in reverse chronological order', () => {
    const activities = buildReleaseWorkbenchActivities(detail(), evidence());

    expect(activities.map((item) => item.kind)).toEqual([
      'approval',
      'production_deployment',
      'production',
      'staging',
      'build',
      'order',
    ]);
    expect(activities[0]).toMatchObject({
      actor: 'Reviewer',
      releaseRunId: 'release-1',
      deploymentRunId: 'production-deploy-1',
    });
    expect(activities.find((item) => item.kind === 'build')?.actor).toBeNull();
  });

  it('does not invent an actor when approval identity is absent', () => {
    const input = evidence();
    const run = input.productionReleaseRuns.items[0]!;
    run.operationApproval.reviewer = null;
    run.operationApproval.requester = null;

    expect(
      buildReleaseWorkbenchActivities(detail(), input).find((item) => item.kind === 'approval')
        ?.actor,
    ).toBeNull();
  });

  it('collapses repeated run snapshots into latest-first stage groups', () => {
    const activities = buildReleaseWorkbenchActivities(detail(), {
      ...evidence(),
      buildRuns: {
        total: 2,
        hasMore: false,
        items: [
          {
            id: 'build-2',
            status: 'failed',
            createdAt: '2026-08-19T06:00:00.000Z',
            startedAt: null,
            finishedAt: null,
          },
          ...evidence().buildRuns.items,
        ],
      },
    } as ReleaseOrderEvidence);
    const groups = buildReleaseWorkbenchActivityGroups(activities);

    expect(groups[0]).toMatchObject({ kind: 'build', count: 2 });
    expect(groups[0]?.latest.buildRunId).toBe('build-2');
    expect(groups[0]?.history[0]?.buildRunId).toBe('build-1');
    expect(groups.find((group) => group.kind === 'production')?.count).toBe(3);
  });
});

function detail(): ReleaseOrderDetail {
  return {
    id: 'order-1',
    projectId: 'project-1',
    releaseVersion: '1.2.0',
    note: null,
    createdAt: '2026-08-19T01:00:00.000Z',
    updatedAt: '2026-08-19T05:00:00.000Z',
    counts: { buildRuns: 1, manifests: 1, releaseRuns: 1 },
    persistedStatus: 'active',
    lifecycle: {
      status: 'production',
      phase: 'production',
      sourceType: 'release_run',
      sourceId: 'release-1',
      sourceStatus: 'running',
      occurredAt: '2026-08-19T04:00:00.000Z',
    },
    resumeStep: 'production',
    preflight: {
      ready: true,
      repository: {
        ready: true,
        branch: 'main',
        identityRevisionId: 'identity-1',
        identityRevision: 1,
      },
      staging: { ready: true },
      production: { ready: true },
    },
  };
}

function evidence() {
  return {
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    buildRuns: {
      total: 1,
      hasMore: false,
      items: [
        {
          id: 'build-1',
          status: 'succeeded',
          createdAt: '2026-08-19T02:00:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
      ],
    },
    stagingDeploymentRuns: {
      total: 1,
      hasMore: false,
      items: [
        {
          id: 'staging-1',
          status: 'completed',
          createdAt: '2026-08-19T03:00:00.000Z',
          startedAt: '2026-08-19T03:00:00.000Z',
          finishedAt: null,
        },
      ],
    },
    productionReleaseRuns: {
      total: 1,
      hasMore: false,
      items: [
        {
          id: 'release-1',
          status: 'running',
          createdAt: '2026-08-19T04:00:00.000Z',
          startedAt: null,
          finishedAt: null,
          operationApproval: {
            id: 'approval-1',
            status: 'approved',
            requestedAt: '2026-08-19T03:30:00.000Z',
            reviewedAt: '2026-08-19T05:00:00.000Z',
            requester: { id: 'requester', name: 'Requester', email: 'requester@example.com' },
            reviewer: { id: 'reviewer', name: 'Reviewer', email: 'reviewer@example.com' },
          },
          deploymentRuns: [
            {
              id: 'production-deploy-1',
              status: 'running',
              createdAt: '2026-08-19T04:30:00.000Z',
              startedAt: '2026-08-19T04:30:00.000Z',
              finishedAt: null,
            },
          ],
        },
      ],
    },
  } as unknown as ReleaseOrderEvidence;
}
