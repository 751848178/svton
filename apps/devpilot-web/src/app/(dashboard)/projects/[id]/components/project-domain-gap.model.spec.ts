import { describe, expect, it } from 'vitest';
import { buildProjectDomainGapFacts } from './project-domain-gap.model';

describe('buildProjectDomainGapFacts', () => {
  it('uses the current route revision when production has no Site', () => {
    const facts = buildProjectDomainGapFacts({
      sites: [],
      applications: [],
      environmentId: 'env-production',
      revision: {
        routeSnapshot: {
          entries: [
            {
              domain: 'app.example.com',
              path: '/api',
              serviceId: 'service-api',
              component: 'API',
              port: 3000,
              tlsMode: 'managed_cert',
            },
          ],
        },
      } as never,
    });
    expect(facts).toEqual([
      expect.objectContaining({
        source: 'route_revision',
        domain: 'app.example.com',
        component: 'API',
        path: '/api',
        port: 3000,
      }),
    ]);
  });

  it('falls back to active service ports without inventing domain or path', () => {
    const facts = buildProjectDomainGapFacts({
      sites: [],
      revision: null,
      environmentId: 'env-production',
      applications: [
        {
          id: 'app-1',
          services: [
            {
              id: 'service-web',
              name: 'Web',
              status: 'active',
              environment: { id: 'env-production' },
          ports: [8080],
            },
          ],
        },
      ] as never,
    });
    expect(facts).toEqual([
      expect.objectContaining({
        source: 'active_service',
        domain: null,
        component: 'Web',
        path: null,
        port: 8080,
      }),
    ]);
  });

  it('does not report a production entry gap when a real Site exists', () => {
    expect(
      buildProjectDomainGapFacts({
        sites: [{ id: 'site-1' }] as never,
        revision: null,
        applications: [],
        environmentId: 'env-production',
      }),
    ).toEqual([]);
  });
});
