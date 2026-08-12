import { describe, expect, it } from 'vitest';
import {
  EMPTY_SETTINGS_ENVIRONMENT_DRAFT,
  environmentIdentityLabelKey,
  isBaselineEnvironment,
  isGovernedEnvironmentSet,
  settingsDraftFromRevision,
  toConfigRevisionDraft,
} from './settings-env.model';

describe('settings-env.model F444 identity helpers', () => {
  it('locks identity on any DeploymentRun, matching the server rule', () => {
    expect(environmentIdentityLabelKey({ identityLockedAt: null, _count: { deploymentRuns: 1 } }))
      .toBe('envIdentityLocked');
    expect(environmentIdentityLabelKey({ identityLockedAt: null, _count: { deploymentRuns: 0 } }))
      .toBe('envIdentityUnlocked');
    expect(environmentIdentityLabelKey({ identityLockedAt: '2026-07-01T00:00:00Z', _count: { deploymentRuns: 0 } }))
      .toBe('envIdentityLocked');
  });

  it('detects governed projects by active Staging + Production baselines', () => {
    const governed = [
      { baselineRole: 'staging', status: 'active' },
      { baselineRole: 'production', status: 'active' },
    ];
    expect(isGovernedEnvironmentSet(governed)).toBe(true);
    expect(isGovernedEnvironmentSet([governed[0]])).toBe(false);
    expect(isGovernedEnvironmentSet([
      { baselineRole: 'staging', status: 'active' },
      { baselineRole: 'production', status: 'archived' },
    ])).toBe(false);
  });

  it('classifies Staging/Production as baseline environments', () => {
    expect(isBaselineEnvironment({ baselineRole: 'staging' })).toBe(true);
    expect(isBaselineEnvironment({ baselineRole: 'production' })).toBe(true);
    expect(isBaselineEnvironment({ baselineRole: null })).toBe(false);
    expect(isBaselineEnvironment({})).toBe(false);
  });
});

describe('settings-env.model F448 route entries round-trip', () => {
  function revision(routeSnapshot: Record<string, unknown>) {
    return {
      id: 'rev-3',
      revision: 3,
      snapshotHash: 'h'.repeat(64),
      plainVariables: {},
      secretReferences: [],
      resourceReferences: [],
      routeSnapshot,
      policyReferences: [],
      source: 'project_management',
      createdAt: '2026-08-06T18:20:00Z',
      current: true,
    } as never;
  }

  it('reads structured entries from the revision into the draft and writes them back verbatim', () => {
    const routeSnapshot = {
      domains: ['demo.f437.example', 'media.demo.f437.example'],
      dnsProvider: 'cloudflare',
      tlsRequired: true,
      proxyTarget: 'web:3000',
      entries: [
        { domain: 'demo.f437.example', path: '/', serviceId: null, component: 'web', port: 3000, tlsMode: 'managed_cert' },
        { domain: 'media.demo.f437.example', path: '/v1', serviceId: null, component: 'api', port: 8080, tlsMode: 'existing_cert_asset' },
      ],
    };
    const draft = settingsDraftFromRevision(revision(routeSnapshot))!;
    expect(draft.route.entries).toEqual(routeSnapshot.entries);
    const payload = toConfigRevisionDraft(draft);
    expect(payload.routeSnapshot.entries).toEqual(routeSnapshot.entries);
    expect(payload.routeSnapshot.domains).toEqual(['demo.f437.example', 'media.demo.f437.example']);
    expect(payload.routeSnapshot.proxyTarget).toBe('web:3000');
    expect(payload.routeSnapshot.tlsRequired).toBe(true);
  });

  it('treats legacy null reference collections as empty draft arrays', () => {
    const draft = settingsDraftFromRevision({
      ...revision({}),
      secretReferences: null,
      resourceReferences: [{ id: 'resource-1', kind: 'resource_instance', name: 'DB' }],
      policyReferences: null,
    } as never)!;
    expect(draft.secrets).toEqual([]);
    expect(draft.resources).toEqual([{
      id: 'resource-1', kind: 'resource_instance', name: 'DB',
      sharedEnvironmentIds: [], risk: 'medium', impact: '',
    }]);
    expect(draft.policyIds).toEqual([]);
  });

  it('derives entries from the legacy domains[] list when the revision predates entries (backward compat)', () => {
    const draft = settingsDraftFromRevision(revision({
      domains: ['demo.f437.example'],
      proxyTarget: 'web : 3000',
      tlsRequired: true,
    }))!;
    expect(draft.route.entries).toEqual([
      { domain: 'demo.f437.example', path: '/', serviceId: null, component: 'web', port: 3000, tlsMode: 'managed_cert' },
    ]);
  });

  it('keeps a non-component proxyTarget honest as an unspecified component', () => {
    const draft = settingsDraftFromRevision(revision({
      domains: ['demo.f437.example'],
      proxyTarget: 'http://127.0.0.1:23992',
    }))!;
    expect(draft.route.entries).toEqual([
      { domain: 'demo.f437.example', path: '/', serviceId: null, component: '', port: null, tlsMode: 'managed_cert' },
    ]);
  });

  it('filters blank domains and normalizes path on write', () => {
    const draft = settingsDraftFromRevision(revision({ domains: [] }))!;
    draft.route.entries = [
      { domain: '  a.example.com  ', path: ' /x ', component: 'web', port: 3000, tlsMode: 'managed_cert' },
      { domain: '   ', path: '/', component: 'api', port: 8080, tlsMode: 'managed_cert' },
    ];
    const payload = toConfigRevisionDraft(draft);
    expect(payload.routeSnapshot.entries).toEqual([
      { domain: 'a.example.com', path: '/x', serviceId: null, component: 'web', port: 3000, tlsMode: 'managed_cert' },
    ]);
    expect(EMPTY_SETTINGS_ENVIRONMENT_DRAFT.route.entries).toEqual([]);
  });

  it('derives flat TLS truth from every structured route entry', () => {
    const draft = settingsDraftFromRevision(revision({ domains: [] }))!;
    draft.route.tlsRequired = true;
    draft.route.entries = [{
      domain: 'plain.example.com', path: '/', serviceId: null,
      component: 'web', port: 80, tlsMode: 'none',
    }];
    expect(toConfigRevisionDraft(draft).routeSnapshot.tlsRequired).toBe(false);
    draft.route.entries.push({
      domain: 'secure.example.com', path: '/', serviceId: null,
      component: 'web', port: 443, tlsMode: 'managed_cert',
    });
    expect(toConfigRevisionDraft(draft).routeSnapshot.tlsRequired).toBe(true);
  });
});
