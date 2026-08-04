import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import {
  ProjectDeliveryEnvironmentStrip,
  ProjectDeliveryWeakSummary,
} from './project-delivery-summary';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe('project delivery home summary', () => {
  it('renders real weak facts and both exact current environment versions', () => {
    const summary = fixture();
    const html = renderToStaticMarkup(
      <>
        <ProjectDeliveryWeakSummary summary={summary} />
        <ProjectDeliveryEnvironmentStrip summary={summary} />
      </>,
    );
    expect(html).toContain('projectDeliveryRuntimeBaseline');
    expect(html).toContain('projectDeliveryType_web_application');
    expect(html).toContain('projectDeliveryArchitecture_monorepo');
    expect(html).toContain('projectDeliveryResourceBindingValue');
    expect(html).toContain('&quot;bound&quot;:0');
    expect(html).toContain('projectDeliverySiteEntriesValue');
    expect(html).toContain('2.4.0-rc.1');
    expect(html).toContain('2.3.2');
    expect(html).toContain('sha256:staging');
    expect(html).toContain('sha256:production');
  });

  it('states unavailable current versions instead of inventing values', () => {
    const summary = fixture();
    summary.currentVersions = { staging: null, production: null };
    const html = renderToStaticMarkup(<ProjectDeliveryEnvironmentStrip summary={summary} />);
    expect(html.match(/projectDeliveryCurrentVersionUnknown/g)).toHaveLength(2);
  });
});

function fixture(): ProjectDeliverySummary {
  const current = (role: 'staging' | 'production') => ({
    id: `version-${role}`,
    releaseOrderId: `order-${role}`,
    releaseVersion: role === 'staging' ? '2.4.0-rc.1' : '2.3.2',
    artifactManifestId: `manifest-${role}`,
    manifestDigest: `sha256:${role}`,
    deploymentRunId: `deployment-${role}`,
    effectiveAt: '2026-08-04T00:00:00.000Z',
  });
  return {
    version: 1,
    scope: { teamId: 'team-1', actorId: 'actor-1', projectId: 'project-1' },
    project: { id: 'project-1', name: 'Payments' },
    repository: {
      provider: 'github',
      canonicalUrl: 'https://github.com/example/payments',
      defaultBranch: 'main',
    },
    intake: { projectType: 'web_application', architecture: 'monorepo', componentCount: 2 },
    baselines: {
      staging: { id: 'env-staging', key: 'staging', name: 'Staging', ready: true },
      production: { id: 'env-production', key: 'production', name: 'Production', ready: false },
    },
    resources: { bound: 0, total: 0 },
    entries: { active: 0, total: 0, unit: 'site' },
    currentVersions: { staging: current('staging'), production: current('production') },
  };
}
