import { describe, expect, it } from 'vitest';
import type { ProjectSite } from '../../types';
import type { DeploymentRun } from '../../types/operations';
import {
  buildRouteEntryViews,
  dnsReadiness,
  dnsView,
  latestRouteProbeEvidence,
  matchSiteByDomain,
  parseRunProbeEvidence,
  routeReadiness,
  tlsReadiness,
  tlsView,
} from './settings-env-routes.model';

function site(overrides: Partial<ProjectSite> = {}): ProjectSite {
  return {
    id: 'site-1',
    name: 'F437 demo site',
    primaryDomain: 'demo.f437.example',
    runtimeType: 'reverse_proxy',
    status: 'active',
    environment: { id: 'env-prod', key: 'production', name: 'Production', status: 'active' },
    ...overrides,
  };
}

function run(overrides: Record<string, unknown> = {}): DeploymentRun {
  return {
    id: 'run-1',
    projectId: 'project-1',
    environment: null,
    targetType: 'release',
    dryRun: false,
    source: 'release_order',
    status: 'completed',
    branch: null,
    commitSha: null,
    commandPlan: {},
    error: null,
    startedAt: '2026-08-06T18:27:00.000Z',
    finishedAt: '2026-08-06T18:28:00.000Z',
    ...(overrides as never),
  };
}

const entries = [
  { domain: 'demo.f437.example', path: '/', component: 'web', port: 3000, tlsMode: 'managed_cert' as const },
  { domain: 'media.demo.f437.example', path: '/v1', component: 'api', port: 8080, tlsMode: 'existing_cert_asset' as const },
];

describe('settings-env-routes.model F448 per-entry views', () => {
  it('joins each entry to its Site by primaryDomain and renders honest columns', () => {
    const rows = buildRouteEntryViews({
      entries,
      sites: [site()],
      deploymentRuns: [],
    });
    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect(first.site?.id).toBe('site-1');
    expect(first.dns).toEqual({ state: 'unavailable', labelKey: 'envRoutesDnsUnavailable' });
    expect(first.tls.state).toBe('unavailable');
    expect(first.probe.state).toBe('unavailable');
    // Unmatched domain keeps an honest unavailable site-less state.
    expect(second.site).toBeNull();
    expect(second.dns.state).toBe('unavailable');
  });

  it('matches sites via aliases', () => {
    const aliasSite = site({ primaryDomain: 'picshare.example.com', aliases: ['demo.f437.example'] });
    expect(matchSiteByDomain([aliasSite], 'demo.f437.example')?.id).toBe('site-1');
    expect(matchSiteByDomain([aliasSite], 'other.example.com')).toBeNull();
  });

  it('renders real DNS status: resolved ready, failed blocked, absent unavailable', () => {
    expect(dnsView(site({ dns: { status: 'resolved', checkedAt: '2026-08-06T18:27:00Z' } })).state)
      .toBe('ready');
    expect(dnsView(site({ dns: { status: 'failed', checkedAt: '2026-08-06T18:27:00Z' } })).state)
      .toBe('blocked');
    expect(dnsView(site({ dns: null })).state).toBe('unavailable');
    expect(dnsView(null).state).toBe('unavailable');
  });

  it('renders real TLS status: valid ready, invalid blocked, expired blocked, absent unavailable', () => {
    expect(tlsView(site({ tls: { status: 'valid', probe: { status: 'valid', checkedAt: '2026-08-06T18:27:00Z' } } })).state)
      .toBe('ready');
    expect(tlsView(site({ tls: { status: 'valid', probe: { status: 'invalid', checkedAt: '2026-08-06T18:27:00Z' } } })).state)
      .toBe('blocked');
    expect(tlsView(site({ tls: { status: 'valid', expiresAt: '2020-01-01T00:00:00Z' } })).state)
      .toBe('blocked');
    expect(tlsView(site({ tls: null })).state).toBe('unavailable');
  });

  it('derives the external probe from the latest siteProbe evidence, else lastSync, else unavailable', () => {
    const withEvidence = run({
      result: {
        siteProbe: {
          primaryDomain: 'demo.f437.example',
          http: { status: 'passed', statusCode: 200, checkedAt: '2026-08-06T18:27:00Z' },
        },
      },
    });
    const probe = buildRouteEntryViews({ entries, sites: [site()], deploymentRuns: [withEvidence] });
    expect(probe[0].probe).toMatchObject({
      state: 'ready',
      labelKey: 'envRoutesProbeHttp',
      detail: '200',
      checkedAt: '2026-08-06T18:27:00Z',
    });
    expect(probe[0].evidence?.deploymentRunId).toBe('run-1');

    const failed = buildRouteEntryViews({
      entries,
      sites: [site()],
      deploymentRuns: [run({
        result: {
          siteProbe: { http: { status: 'failed', statusCode: 500, checkedAt: '2026-08-06T18:27:00Z' } },
        },
      })],
    });
    expect(failed[0].probe.state).toBe('blocked');

    const synced = buildRouteEntryViews({
      entries,
      sites: [site({ lastSyncAt: '2026-08-06T18:26:00Z' })],
      deploymentRuns: [],
    });
    expect(synced[0].probe.labelKey).toBe('envRoutesProbeSyncedAt');
  });

  it('surfaces D14/D15/D16 gate readiness with blocked reasons and honest unavailable (AC-SET-048)', () => {
    const ready = site({
      status: 'active',
      dns: { status: 'resolved', checkedAt: '2026-08-06T18:27:00Z' },
      tls: { status: 'valid', expiresAt: '2026-09-07T00:00:00Z', probe: { status: 'valid', checkedAt: '2026-08-06T18:27:00Z' } },
    });
    expect(dnsReadiness(ready)).toEqual({ state: 'ready', labelKey: 'envRoutesGateReady' });
    expect(tlsReadiness(ready)).toEqual({ state: 'ready', labelKey: 'envRoutesGateReady' });
    expect(routeReadiness(ready)).toEqual({ state: 'ready', labelKey: 'envRoutesGateReady' });

    const blockedDns = site({ status: 'active', dns: { status: 'failed', checkedAt: '2026-08-06T18:27:00Z' } });
    expect(dnsReadiness(blockedDns)).toEqual({
      state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey: 'envRoutesReasonDnsFailed',
    });

    const expiredTls = site({ status: 'active', tls: { status: 'valid', expiresAt: '2020-01-01T00:00:00Z' } });
    expect(tlsReadiness(expiredTls)).toEqual({
      state: 'blocked', labelKey: 'envRoutesGateBlocked', detailKey: 'envRoutesReasonTlsExpired',
    });

    expect(dnsReadiness(null)).toMatchObject({ state: 'unavailable', detailKey: 'envRoutesReasonDnsSiteMissing' });
    expect(dnsReadiness(site({ dns: null }))).toMatchObject({ state: 'unavailable', detailKey: 'envRoutesReasonDnsProbeMissing' });
    expect(tlsReadiness(site({ tls: null }))).toMatchObject({ state: 'unavailable', detailKey: 'envRoutesReasonTlsMissing' });
    expect(routeReadiness(site({ status: 'error' }))).toMatchObject({
      state: 'blocked', detailKey: 'envRoutesReasonRouteSiteError',
    });
    expect(routeReadiness(null)).toMatchObject({ state: 'unavailable', detailKey: 'envRoutesReasonRouteSiteMissing' });
  });

  it('parses run.result.siteProbe into the shared evidence shape for the drill-down (AC-SET-049)', () => {
    const parsed = parseRunProbeEvidence(run({
      result: {
        siteProbe: {
          version: 1,
          primaryDomain: 'demo.f437.example',
          finalUrl: 'https://demo.f437.example',
          probedAt: '2026-08-06T18:27:00.849Z',
          dns: {
            status: 'resolved',
            hostname: 'demo.f437.example',
            records: ['198.18.11.9'],
            error: null,
            checkedAt: '2026-08-06T18:27:00.577Z',
          },
          tls: {
            status: 'valid',
            host: 'demo.f437.example',
            port: 443,
            servername: 'demo.f437.example',
            cert: { subject: 'CN=demo.f437.example', issuer: 'CN=CA', validFrom: null, validUntil: '2026-09-07T00:00:00Z', expired: false },
            error: null,
            checkedAt: '2026-08-06T18:27:00.727Z',
          },
          http: {
            status: 'passed',
            url: 'http://127.0.0.1:23992/',
            finalUrl: 'https://demo.f437.example',
            statusCode: 200,
            bodySignature: 'sha256:abc',
            error: null,
            checkedAt: '2026-08-06T18:27:00.849Z',
          },
        },
        routeSwitch: {
          status: 'switched',
          domains: ['demo.f437.example'],
          releaseRunId: 'release-1',
          deploymentRunId: 'run-1',
          switchedAt: '2026-08-06T18:27:00.957Z',
        },
      },
    }));
    expect(parsed).not.toBeNull();
    expect(parsed?.siteProbe.http.statusCode).toBe(200);
    expect(parsed?.siteProbe.dns.status).toBe('resolved');
    expect(parsed?.siteProbe.tls.cert?.subject).toBe('CN=demo.f437.example');
    expect(parsed?.routeSwitch?.status).toBe('switched');
    expect(parsed?.deploymentRunId).toBe('run-1');
    expect(parseRunProbeEvidence(run({ result: null }))).toBeNull();
    expect(latestRouteProbeEvidence([run({ result: null }), run()])).toBeNull();
  });

  it('builds the deployment-records deep link for the probe run', async () => {
    const { buildRouteProbeEvidenceHref } = await import('./settings-env-routes.model');
    expect(buildRouteProbeEvidenceHref('project-1', 'run-1'))
      .toBe('/projects/project-1?view=deployments&runId=run-1');
  });
});
