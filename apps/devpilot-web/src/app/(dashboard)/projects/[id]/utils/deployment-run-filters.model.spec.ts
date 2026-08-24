import { describe, expect, it } from 'vitest';
import {
  applyDeploymentRunFilters,
  deploymentRunFilterOptions,
  deploymentRunFiltersActive,
  parseDeploymentRunFilters,
} from './deployment-run-filters.model';
import type { DeploymentRun } from '../types/operations';

function run(overrides: Partial<DeploymentRun> & Pick<DeploymentRun, 'id'>): DeploymentRun {
  return {
    environment: null,
    targetType: 'server',
    dryRun: false,
    source: 'manual',
    status: 'succeeded',
    branch: null,
    commitSha: null,
    error: null,
    startedAt: '2026-08-01T00:00:00Z',
    finishedAt: null,
    projectId: 'p1',
    ...overrides,
  } as DeploymentRun;
}

describe('deployment run filters (DEP-5)', () => {
  const runs = [
    run({ id: 'a', environment: 'dev', status: 'failed', source: 'release_order', startedAt: '2026-08-10T10:00:00Z' }),
    run({ id: 'b', environment: 'dev', status: 'succeeded', source: 'api', startedAt: '2026-08-11T10:00:00Z' }),
    run({ id: 'c', environment: 'production', status: 'failed', source: 'api', startedAt: '2026-08-01T10:00:00Z' }),
    run({ id: 'd', environment: null, status: 'blocked', source: 'manual', startedAt: '2026-08-05T10:00:00Z' }),
  ];

  it('parses filters from URL params and defaults to latest-first', () => {
    expect(parseDeploymentRunFilters(null)).toEqual({
      environment: '',
      status: '',
      source: '',
      sort: 'latest',
    });
    const parsed = parseDeploymentRunFilters(
      new URLSearchParams('runEnv=dev&runStatus=failed&runSource=release_order&runSort=earliest'),
    );
    expect(parsed).toEqual({
      environment: 'dev',
      status: 'failed',
      source: 'release_order',
      sort: 'earliest',
    });
  });

  it('filters by environment, status and source independently and combined', () => {
    expect(applyDeploymentRunFilters(runs, { ...parseFilters(''), environment: 'dev' }).map((r) => r.id)).toEqual(['b', 'a']);
    expect(applyDeploymentRunFilters(runs, { ...parseFilters(''), status: 'failed' }).map((r) => r.id)).toEqual(['a', 'c']);
    expect(applyDeploymentRunFilters(runs, { ...parseFilters(''), source: 'api' }).map((r) => r.id)).toEqual(['b', 'c']);
    expect(
      applyDeploymentRunFilters(runs, {
        ...parseFilters(''),
        environment: 'dev',
        status: 'failed',
      }).map((r) => r.id),
    ).toEqual(['a']);
  });

  it('sorts latest-first by default and earliest-first on demand', () => {
    const none = parseFilters('');
    expect(applyDeploymentRunFilters(runs, none).map((r) => r.id)).toEqual(['b', 'a', 'd', 'c']);
    expect(
      applyDeploymentRunFilters(runs, { ...none, sort: 'earliest' }).map((r) => r.id),
    ).toEqual(['c', 'd', 'a', 'b']);
  });

  it('derives filter options from real data and reports active state', () => {
    const options = deploymentRunFilterOptions(runs);
    expect(options.environments).toEqual(['dev', 'production']);
    expect(options.statuses).toEqual(['blocked', 'failed', 'succeeded']);
    expect(options.sources).toEqual(['api', 'manual', 'release_order']);
    expect(deploymentRunFiltersActive(parseFilters(''))).toBe(false);
    expect(deploymentRunFiltersActive({ ...parseFilters(''), status: 'failed' })).toBe(true);
  });
});

function parseFilters(query: string) {
  return parseDeploymentRunFilters(query ? new URLSearchParams(query) : null);
}
