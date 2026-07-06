/**
 * Pure metric-trend / metric-series summarizers.
 *
 * Extracted verbatim from `ResourceControlService.summarizeMetricTrends` and
 * `buildMetricSeries` so the list-read service stays under the 200-line ceiling.
 * Stateless — group snapshots and compute trend/series summaries. No behavior
 * change.
 */

import {
  metricSeriesValue,
  summarizeMetricNumber,
  ResourceMetricSnapshotForTrend,
  ResourceMetricSeriesMetric,
} from './resource-control-metrics.utils';

export function summarizeMetricTrends(snapshots: ResourceMetricSnapshotForTrend[], windowMinutes = 60) {
  const groups = new Map<string, ResourceMetricSnapshotForTrend[]>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.resourceId}:${snapshot.metricSource}`;
    groups.set(key, [...(groups.get(key) || []), snapshot]);
  }

  return Array.from(groups.values())
    .map((group) => {
      const ordered = [...group].sort((left, right) => right.sampledAt.getTime() - left.sampledAt.getTime());
      const latest = ordered[0];
      const oldest = ordered[ordered.length - 1];

      return {
        id: latest.resourceId,
        resourceId: latest.resourceId,
        projectId: latest.projectId,
        environmentId: latest.environmentId,
        sourceType: latest.sourceType,
        provider: latest.provider,
        kind: latest.kind,
        metricSource: latest.metricSource,
        windowMinutes,
        sampleCount: ordered.length,
        firstSampledAt: oldest.sampledAt,
        lastSampledAt: latest.sampledAt,
        resource: latest.resource,
        cpuPercent: summarizeMetricNumber(ordered.map((snapshot) => snapshot.cpuPercent)),
        memoryPercent: summarizeMetricNumber(ordered.map((snapshot) => snapshot.memoryPercent)),
        memoryUsageBytes: summarizeMetricNumber(ordered.map((snapshot) => snapshot.memoryUsageBytes)),
        networkInputBytes: summarizeMetricNumber(ordered.map((snapshot) => snapshot.networkInputBytes)),
        networkOutputBytes: summarizeMetricNumber(ordered.map((snapshot) => snapshot.networkOutputBytes)),
        blockInputBytes: summarizeMetricNumber(ordered.map((snapshot) => snapshot.blockInputBytes)),
        blockOutputBytes: summarizeMetricNumber(ordered.map((snapshot) => snapshot.blockOutputBytes)),
        pids: summarizeMetricNumber(ordered.map((snapshot) => snapshot.pids)),
      };
    })
    .sort((left, right) => right.lastSampledAt.getTime() - left.lastSampledAt.getTime());
}

export function buildMetricSeries(
  snapshots: ResourceMetricSnapshotForTrend[],
  metric: ResourceMetricSeriesMetric = 'cpuPercent',
  windowMinutes = 360,
  limit = 120,
) {
  const groups = new Map<string, ResourceMetricSnapshotForTrend[]>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.resourceId}:${snapshot.metricSource}`;
    groups.set(key, [...(groups.get(key) || []), snapshot]);
  }

  return Array.from(groups.values())
    .map((group) => {
      const ordered = [...group].sort((left, right) => left.sampledAt.getTime() - right.sampledAt.getTime());
      const latest = ordered[ordered.length - 1];
      const oldest = ordered[0];
      const valuesLatestFirst = [...ordered].reverse().map((snapshot) => metricSeriesValue(snapshot, metric));
      const points = ordered.map((snapshot) => ({
        snapshotId: snapshot.id,
        sampledAt: snapshot.sampledAt,
        value: metricSeriesValue(snapshot, metric),
        status: snapshot.status,
      }));

      return {
        id: `${latest.resourceId}:${latest.metricSource}:${metric}`,
        resourceId: latest.resourceId,
        projectId: latest.projectId,
        environmentId: latest.environmentId,
        sourceType: latest.sourceType,
        provider: latest.provider,
        kind: latest.kind,
        metricSource: latest.metricSource,
        metric,
        windowMinutes,
        limit,
        sampleCount: ordered.length,
        firstSampledAt: oldest.sampledAt,
        lastSampledAt: latest.sampledAt,
        resource: latest.resource,
        summary: summarizeMetricNumber(valuesLatestFirst),
        points,
      };
    })
    .sort((left, right) => right.lastSampledAt.getTime() - left.lastSampledAt.getTime());
}
