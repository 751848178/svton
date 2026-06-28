import {
  buildDockerStatsMetricSnapshotInputs,
  extractDockerStatsRows,
} from './docker-stats-metrics';

describe('docker stats metrics', () => {
  const context = {
    teamId: 'team-1',
    resourceId: 'resource-1',
    resourceActionRunId: 'run-1',
    serverId: 'server-1',
    projectId: 'project-1',
    environmentId: 'env-1',
    sourceType: 'server',
    provider: 'docker',
    kind: 'docker_container',
    sampledAt: new Date('2026-06-27T10:00:00.000Z'),
  };

  it('extracts Docker stats JSON lines from stdout previews and logs without duplicates', () => {
    const line = JSON.stringify({
      Name: 'api',
      CPUPerc: '0.35%',
      MemUsage: '12.5MiB / 512MiB',
      MemPerc: '2.44%',
      NetIO: '1.2kB / 3.4kB',
      BlockIO: '0B / 8.19kB',
      PIDs: '12',
    });

    expect(extractDockerStatsRows(
      { stdoutPreview: `noise\n${line}` },
      [{ stream: 'stdout', message: line }],
    )).toHaveLength(1);
  });

  it('normalizes Docker stats fields into metric snapshot inputs', () => {
    const snapshots = buildDockerStatsMetricSnapshotInputs(
      context,
      {
        stdoutPreview: JSON.stringify({
          Container: 'abc123',
          Name: 'api',
          CPUPerc: '12.50%',
          MemUsage: '100MiB / 1GiB',
          MemPerc: '9.77%',
          NetIO: '1.5kB / 2MB',
          BlockIO: '0B / 8.19kB',
          PIDs: '7',
        }),
      },
    );

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual(expect.objectContaining({
      teamId: 'team-1',
      resourceId: 'resource-1',
      resourceActionRunId: 'run-1',
      serverId: 'server-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      sourceType: 'server',
      provider: 'docker',
      kind: 'docker_container',
      metricSource: 'docker_stats',
      status: 'collected',
      sampledAt: new Date('2026-06-27T10:00:00.000Z'),
      cpuPercent: 12.5,
      memoryUsageBytes: 100 * 1024 ** 2,
      memoryLimitBytes: 1024 ** 3,
      memoryPercent: 9.77,
      networkInputBytes: 1500,
      networkOutputBytes: 2 * 1000 ** 2,
      blockInputBytes: 0,
      pids: 7,
    }));
    expect(snapshots[0].blockOutputBytes).toBeCloseTo(8190);
  });

  it('returns no snapshots when no Docker stats JSON is present', () => {
    expect(buildDockerStatsMetricSnapshotInputs(context, { stdoutPreview: 'not json' })).toEqual([]);
  });
});
