import { describe, expect, it } from 'vitest';
import type { ProjectEnvironment, ProjectSite } from '../../types';
import type { DeploymentRun } from '../../types/operations';
import { buildVerificationEvidenceRows } from './settings-verification-evidence.model';

const environment = {
  id: 'env-prod',
  key: 'production',
  name: '生产环境',
} as ProjectEnvironment;

function site(overrides: Partial<ProjectSite> = {}): ProjectSite {
  return {
    id: 'site-1',
    name: 'Picshare',
    primaryDomain: 'picshare.example.com',
    runtimeType: 'reverse_proxy',
    status: 'active',
    environment: { id: 'env-prod', key: 'production', name: '生产环境', status: 'active' },
    ...overrides,
  };
}

function run(overrides: Partial<DeploymentRun> = {}): DeploymentRun {
  return {
    id: 'run-1',
    projectId: 'project-1',
    environment: 'production',
    projectEnvironment: { id: 'env-prod', key: 'production', name: '生产环境', status: 'active' },
    targetType: 'release',
    dryRun: false,
    source: 'release_order',
    status: 'completed',
    branch: 'main',
    commitSha: 'abc123',
    commandPlan: {},
    error: null,
    startedAt: '2026-08-27T08:00:00Z',
    finishedAt: '2026-08-27T08:01:00Z',
    ...overrides,
  };
}

describe('settings verification evidence model', () => {
  it('keeps unconfigured checks unavailable instead of inventing passing evidence', () => {
    const rows = buildVerificationEvidenceRows({
      environment,
      snapshot: undefined,
      sites: [],
      deploymentRuns: [],
    });
    expect(rows.map((row) => row.id)).toEqual(['health', 'destinations', 'entry']);
    expect(rows.every((row) => row.status === 'unavailable')).toBe(true);
    expect(rows.every((row) => row.checkedAt === null)).toBe(true);
  });

  it('separates configured rules from explicit Site and DeploymentRun results', () => {
    const rows = buildVerificationEvidenceRows({
      environment,
      snapshot: {
        profile: 'local_acceptance_v1',
        metrics: 'local-health-probe-v1',
        logs: 'local-runtime-logs-v1',
      },
      sites: [site({
        dns: { status: 'resolved', checkedAt: '2026-08-27T07:00:00Z' },
        tls: { probe: { status: 'valid', checkedAt: '2026-08-27T07:01:00Z' } },
      })],
      deploymentRuns: [run({
        result: {
          siteProbe: {
            primaryDomain: 'picshare.example.com',
            http: { status: 'passed', statusCode: 200, checkedAt: '2026-08-27T08:00:30Z' },
          },
        },
      })],
    });
    expect(rows.find((row) => row.id === 'health')?.status).toBe('configured');
    expect(rows.find((row) => row.id === 'dns:site-1')?.status).toBe('ready');
    expect(rows.find((row) => row.id === 'tls:site-1')?.status).toBe('ready');
    expect(rows.find((row) => row.id === 'http:site-1')).toMatchObject({
      status: 'ready',
      deploymentRunId: 'run-1',
      checkedAt: '2026-08-27T08:00:30Z',
    });
  });

  it('does not attribute a probe from another environment or domain', () => {
    const rows = buildVerificationEvidenceRows({
      environment,
      sites: [site()],
      deploymentRuns: [run({
        projectEnvironment: { id: 'env-staging', key: 'staging', name: '预发', status: 'active' },
        result: {
          siteProbe: {
            primaryDomain: 'other.example.com',
            http: { status: 'passed', checkedAt: '2026-08-27T08:00:30Z' },
          },
        },
      })],
    });
    expect(rows.find((row) => row.id === 'http:site-1')).toMatchObject({
      status: 'unavailable',
      deploymentRunId: null,
      checkedAt: null,
    });
  });

  it('preserves explicit failed probe details and evidence linkage', () => {
    const rows = buildVerificationEvidenceRows({
      environment,
      sites: [site()],
      deploymentRuns: [run({
        result: {
          siteProbe: {
            primaryDomain: 'picshare.example.com',
            http: {
              status: 'failed',
              checkedAt: '2026-08-27T08:00:30Z',
              error: { code: 'HTTP_TIMEOUT', message: 'HTTP probe timed out' },
            },
          },
        },
      })],
    });
    expect(rows.find((row) => row.id === 'http:site-1')).toMatchObject({
      status: 'failed',
      resultDetail: 'HTTP probe timed out',
      deploymentRunId: 'run-1',
    });
  });
});
