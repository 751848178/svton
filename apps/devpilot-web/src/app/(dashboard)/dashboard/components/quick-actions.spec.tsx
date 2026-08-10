import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QuickActions } from './quick-actions';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('QuickActions project intake route', () => {
  it('routes New Project to repository intake instead of the ZIP generator', () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const html = renderToStaticMarkup(<QuickActions />);

    expect(html).toContain('href="/projects/create"');
    expect(html).not.toContain('href="/projects/new"');
    expect(html).toContain('quickNewProjectDescription');
  });
});
