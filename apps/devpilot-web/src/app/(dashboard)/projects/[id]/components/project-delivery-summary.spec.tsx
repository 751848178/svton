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
  it('renders one server-owned next action and progressively disclosed versions', () => {
    const summary = fixture();
    const html = renderToStaticMarkup(
      <>
        <ProjectDeliveryWeakSummary summary={summary} />
        <ProjectDeliveryEnvironmentStrip summary={summary} />
      </>,
    );
    expect(html).toContain('projectDeliveryNow');
    expect(html).toContain('projectDeliveryCheckpoint_targets');
    expect(html.match(/projectDeliveryFixNow/g)).toHaveLength(1);
    expect(html).toContain('projectDeliveryReasonTargetMissing');
    expect(html).toContain('min-h-11');
    expect(html).toContain('releaseEnvironmentStaging');
    expect(html).toContain('releaseEnvironmentProduction');
    expect(html.match(/projectDeliveryReleaseVersion/g)).toHaveLength(2);
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
    version: 2,
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
    resources: { bound: 0, total: 0, byEnvironment: { staging: 0, production: 0 } },
    entries: { active: 0, total: 0, unit: 'site', productionDomain: null },
    currentVersions: { staging: current('staging'), production: current('production') },
    checkpoints: [{
      id: 'targets',
      scope: 'production',
      status: 'action_required',
      reasonCodes: ['deployment_target_missing'],
      evidenceRefs: [],
      action: { kind: 'bind_target', href: '/projects/project-1/settings' },
    }],
    nextAction: { kind: 'bind_target', href: '/projects/project-1/settings' },
  };
}
