import { describe, expect, it } from 'vitest';
import {
  EMPTY_SETTINGS_ENVIRONMENT_DRAFT,
  type SettingsEnvironmentDraft,
} from './settings-env.model';
import { buildSettingsRevisionChanges } from './settings-revision-review.model';

describe('buildSettingsRevisionChanges', () => {
  it('returns only changed configuration areas with before and after values', () => {
    const changes = buildSettingsRevisionChanges(EMPTY_SETTINGS_ENVIRONMENT_DRAFT, {
      ...EMPTY_SETTINGS_ENVIRONMENT_DRAFT,
      secrets: [{ id: 'secret-1', targetEnvKey: 'DATABASE_URL' }],
      policyIds: ['policy-1'],
    });
    expect(changes).toEqual([
      { area: 'secrets', before: '—', after: 'DATABASE_URL ← secret-1' },
      { area: 'access', before: '—', after: 'policy-1' },
    ]);
  });

  it('includes the complete persisted semantics for variables, resources, routes, policies and observability', () => {
    const current = {
      ...EMPTY_SETTINGS_ENVIRONMENT_DRAFT,
      plainVariables: { NODE_ENV: 'development' },
      policyIds: ['policy-1'],
      resources: [
        {
          kind: 'managed_resource' as const,
          id: 'redis-1',
          name: 'Redis',
          sharedEnvironmentIds: ['env-a'],
          risk: 'medium' as const,
          impact: 'cache only',
          componentKey: 'api',
          envBindings: [{ sourceKey: 'URL', targetEnvKey: 'REDIS_URL' }],
        },
      ],
    } satisfies SettingsEnvironmentDraft;
    const changes = buildSettingsRevisionChanges(
      current,
      {
        ...current,
        plainVariables: { NODE_ENV: 'production' },
        resources: [
          {
            ...current.resources[0],
            sharedEnvironmentIds: ['env-a', 'env-b'],
            risk: 'high',
            impact: 'api and worker',
          },
        ],
        route: {
          domains: 'app.example.com',
          dnsProvider: 'cloudflare',
          tlsRequired: true,
          proxyTarget: 'api:3000',
          entries: [
            {
              domain: 'app.example.com',
              path: '/api',
              serviceId: 'service-1',
              component: 'api',
              port: 3000,
              tlsMode: 'managed_cert',
            },
          ],
        },
        observability: { profile: 'local_acceptance_v1' },
      },
      {
        current: [{ id: 'policy-1', name: 'Deploy', effect: 'allow', actions: ['read'] }],
        available: [{ id: 'policy-1', name: 'Deploy', effect: 'allow', actions: ['write'] }],
      },
    );

    expect(changes.map((item) => item.area)).toEqual([
      'variables',
      'resources',
      'access',
      'routes',
      'observability',
    ]);
    expect(changes.find((item) => item.area === 'resources')?.after).toContain(
      'shared=env-a|env-b',
    );
    expect(changes.find((item) => item.area === 'resources')?.after).toContain('risk=high');
    expect(changes.find((item) => item.area === 'access')?.after).toContain('allow · write');
    expect(changes.find((item) => item.area === 'routes')?.after).toContain('service=service-1');
    expect(changes.find((item) => item.area === 'routes')?.after).toContain('tls=managed_cert');
    expect(changes.find((item) => item.area === 'observability')?.after).toContain(
      'logs=local-runtime-logs-v1',
    );
  });
});
