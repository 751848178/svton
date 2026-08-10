import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDirectoryPanel } from './project-directory-panel';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('./project-card', () => ({
  ProjectCard: () => <article>project</article>,
}));

describe('ProjectDirectoryPanel', () => {
  it('retains the five-column directory structure for empty states', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryPanel
        items={[]}
        validating={false}
        empty={<span>empty-state</span>}
      />,
    );

    expect(html).toContain('directoryProject');
    expect(html).toContain('directoryType');
    expect(html).toContain('directoryBaselines');
    expect(html).toContain('Production');
    expect(html).toContain('directoryRecentActivity');
    expect(html).toContain('empty-state');
  });
});
