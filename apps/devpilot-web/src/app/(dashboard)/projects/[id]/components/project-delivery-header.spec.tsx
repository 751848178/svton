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
      />,
    );
    const withoutSite = renderToStaticMarkup(
      <ProjectDeliveryHeader
        summary={summary(null)}
      />,
    );

    expect(withSite).toContain('href="https://pay.example.com"');
    expect(withSite).toContain('target="_blank"');
    expect(withSite).toContain('rel="noopener noreferrer"');
    expect(withSite).toContain('projectDeliveryProductionSite');
    expect(withoutSite).not.toContain('projectDeliveryProductionSite');
  });

  it('stacks identity and actions before the small-screen breakpoint', () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const markup = renderToStaticMarkup(
      <ProjectDeliveryHeader
        summary={summary('pay.example.com')}
      />,
    );

    expect(markup).toContain('flex-col gap-4 sm:flex-row');
    expect(markup).toContain('w-full min-w-0 sm:flex-1');
    expect(markup).toContain('w-full flex-wrap items-center gap-2 sm:w-auto');
  });
});

function summary(productionDomain: string | null): ProjectDeliverySummary {
  return {
    version: 2,
    scope: { teamId: 'team-1', actorId: 'actor-1', projectId: 'project-1' },
    project: { id: 'project-1', name: 'Payments' },
    repository: null,
    intake: { projectType: null, architecture: null, componentCount: null },
    baselines: { staging: null, production: null },
    resources: { bound: 0, total: 0, byEnvironment: { staging: 0, production: 0 } },
    entries: {
      active: productionDomain ? 1 : 0,
      total: productionDomain ? 1 : 0,
      unit: 'site',
      productionDomain,
    },
    currentVersions: { staging: null, production: null },
    checkpoints: [],
    nextAction: null,
  };
}
