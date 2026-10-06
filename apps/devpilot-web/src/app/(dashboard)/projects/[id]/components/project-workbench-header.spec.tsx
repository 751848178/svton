import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectWorkbenchHeader } from './project-workbench-header';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock('next/navigation', () => ({ usePathname: () => '/projects/project-1' }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('ProjectWorkbenchHeader', () => {
  it('keeps deterministic back, secondary configuration, and one primary action', () => {
    const html = renderToStaticMarkup(
      <ProjectWorkbenchHeader
        identity={{
          projectId: 'project-1',
          name: 'Picshare',
          repository: 'https://example.test/picshare.git',
          branch: 'main',
          commitSha: '1234567890',
        }}
        issue={<div>project-issue</div>}
      />,
    );
    expect(html).toContain('href="/projects"');
    expect(html).toContain('aria-label="backToProjects"');
    expect(html).toContain('href="/projects/project-1/settings"');
    expect(html).toContain('projectConfigurationTitle');
    expect(html).toContain('href="/projects/project-1?create=true"');
    expect(html).toContain('project-issue');
    expect(html).toContain('grid gap-3 pt-3 md:pt-4');
    expect(html).not.toContain('grid gap-3 py-3 md:py-4');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('workbenchNavigation');
  });
});
