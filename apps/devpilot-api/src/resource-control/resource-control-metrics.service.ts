/**
 * Resource-control metrics persistence service.
 *
 * Owns the docker-container-stats metric snapshot persistence that runs after
 * a completed `docker.container.stats` action run. Extracted from
 * `ResourceControlService.persistDockerMetricSnapshotsFromActionRun`. Behavior
 * preserved verbatim.
 */

import { Injectable } from '@nestjs/common';
import { ResourceControlRepository } from './resource-control.repository';
import { buildDockerStatsMetricSnapshotInputs } from './metrics/docker-stats-metrics';

@Injectable()
export class ResourceControlMetricsService {
  constructor(private readonly repo: ResourceControlRepository) {}

  async persistDockerMetricSnapshotsFromActionRun(
    teamId: string, resourceActionRunId: string, result: unknown, logs?: unknown,
  ) {
    const actionRun = await this.repo.findActionRun({
      where: { id: resourceActionRunId, teamId },
      select: {
        id: true, teamId: true, resourceId: true, action: true, dryRun: true, status: true,
        resource: { select: { id: true, sourceType: true, provider: true, kind: true, serverId: true, projectId: true, environmentId: true } },
      },
    });

    if (!actionRun || actionRun.action !== 'docker.container.stats' || actionRun.dryRun || actionRun.status !== 'completed') {
      return 0;
    }

    const existingCount = await this.repo.countMetricSnapshots({ where: { teamId, resourceActionRunId } });
    if (existingCount > 0) return 0;

    const snapshots = buildDockerStatsMetricSnapshotInputs(
      {
        teamId: actionRun.teamId, resourceId: actionRun.resourceId, resourceActionRunId: actionRun.id,
        serverId: actionRun.resource.serverId, projectId: actionRun.resource.projectId,
        environmentId: actionRun.resource.environmentId, sourceType: actionRun.resource.sourceType,
        provider: actionRun.resource.provider, kind: actionRun.resource.kind,
      },
      result, logs,
    );

    if (snapshots.length === 0) return 0;

    const created = await this.repo.createManyMetricSnapshots({ data: snapshots });
    return created.count;
  }
}
