import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDirectoryEmpty } from './project-directory-empty';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/ui', () => ({}));
vi.mock('@/components/ui', () => ({
  EmptyState: ({
    title,
    description,
    action,
  }: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
  }) => (
    <section>
      {title}
      {description}
      {action}
    </section>
  ),
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  LinkButton: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ProjectDirectoryEmpty', () => {
  it('offers the canonical repository-intake path for a truly empty directory', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryEmpty
        filtered={false}
        onReset={vi.fn()}
      />,
    );

    expect(html).toContain('href="/projects/create"');
    expect(html).toContain('createProject');
    expect(html).not.toContain('href="/projects/new"');
  });

  it('offers recovery without fake projects for a filtered empty result', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryEmpty
        filtered
        onReset={vi.fn()}
      />,
    );

    expect(html).toContain('noSearchResults');
    expect(html).toContain('resetFilters');
    expect(html).not.toContain('href="/projects/new"');
  });
});
