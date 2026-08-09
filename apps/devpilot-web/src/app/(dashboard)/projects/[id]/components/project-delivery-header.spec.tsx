import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { ProjectDeliveryHeader } from './project-delivery-header';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  LinkButton: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

describe('ProjectDeliveryHeader production site entry', () => {
  it('links only the exact active Production Site domain', () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const withSite = renderToStaticMarkup(
      <ProjectDeliveryHeader
        summary={summary('pay.example.com')}
        showCreate
        onCreate={vi.fn()}
      />,
    );
    const withoutSite = renderToStaticMarkup(
      <ProjectDeliveryHeader
        summary={summary(null)}
        showCreate
        onCreate={vi.fn()}
      />,
    );

    expect(withSite).toContain('href="https://pay.example.com"');
    expect(withSite).toContain('target="_blank"');
    expect(withSite).toContain('rel="noopener noreferrer"');
    expect(withSite).toContain('projectDeliveryProductionSite');
    expect(withoutSite).not.toContain('projectDeliveryProductionSite');
  });
});

function summary(productionDomain: string | null): ProjectDeliverySummary {
  return {
    version: 1,
    scope: { teamId: 'team-1', actorId: 'actor-1', projectId: 'project-1' },
    project: { id: 'project-1', name: 'Payments' },
    repository: null,
    intake: { projectType: null, architecture: null, componentCount: null },
    baselines: { staging: null, production: null },
    resources: { bound: 0, total: 0 },
    entries: {
      active: productionDomain ? 1 : 0,
      total: productionDomain ? 1 : 0,
      unit: 'site',
      productionDomain,
    },
    currentVersions: { staging: null, production: null },
  };
}
