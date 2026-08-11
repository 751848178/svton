import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDirectoryItem } from '../types';
import { ProjectCard } from './project-card';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('ProjectCard server-owned action', () => {
  it('uses the exact nextAction deep link as its only task action', () => {
    const html = renderToStaticMarkup(<ProjectCard project={project()} />);

    expect(html).toContain(
      'href="/projects/project-1/settings?section=environments&amp;env=production&amp;envTab=targets"',
    );
    expect(html).toContain('data-current-action="bind_target"');
    expect(html).toContain('projectDeliveryFixNow');
    expect(html).toContain('min-h-11');
    expect(html).toContain('lg:grid-cols-');
  });
});

function project(): ProjectDirectoryItem {
  return {
    id: 'project-1', name: 'Payments', status: 'needs_configuration',
    repository: { provider: 'github', canonicalUrl: 'https://github.com/example/payments' },
    intake: { projectType: 'web_application', architecture: 'monorepo', componentCount: 2 },
    baselines: {
      staging: { id: 'staging-1', key: 'staging', name: 'Staging', ready: true },
      production: { id: 'production-1', key: 'production', name: 'Production', ready: false },
    },
    production: { currentVersion: null, domain: null },
    activity: {
      id: 'activity-1', type: 'project', status: 'ready', summary: null,
      occurredAt: '2026-08-11T00:00:00.000Z',
    },
    checkpoints: [],
    nextAction: {
      kind: 'bind_target',
      href: '/projects/project-1/settings?section=environments&env=production&envTab=targets',
    },
  };
}
