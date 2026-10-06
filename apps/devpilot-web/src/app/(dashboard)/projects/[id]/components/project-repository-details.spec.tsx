// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { ProjectRepositoryDetails } from './project-repository-details';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));

describe('ProjectRepositoryDetails', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('starts collapsed on every mount', async () => {
    await render(root);
    expect(disclosure(container).getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('https://github.com/example/service');

    await act(async () => disclosure(container).click());
    expect(disclosure(container).getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('https://github.com/example/service');

    await act(async () => root.unmount());
    root = createRoot(container);
    await render(root);
    expect(disclosure(container).getAttribute('aria-expanded')).toBe('false');
  });

  it('shows only real repository facts after the title is activated', async () => {
    await render(root);
    await act(async () => disclosure(container).click());
    expect(container.querySelector('[aria-label="repositoryOverviewTitle"]')).not.toBeNull();
    expect(container.textContent).not.toContain('aaaaaaaaaaaa');
    expect(container.textContent).not.toContain('repositoryOverviewHosting');
    expect(container.textContent).not.toContain('repositoryOverviewCurrentCommit');
    expect(container.textContent).not.toContain('repositoryLatestAnalysisTitle');
    expect(container.textContent).not.toContain('repositoryAnalysisViewWorkspace');
  });
});

async function render(root: Root) {
  await act(async () => root.render(<ProjectRepositoryDetails analysis={analysis()} />));
}

function disclosure(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('[aria-controls]')!;
}

function analysis(): RepositoryAnalysisHook {
  return {
    loading: false,
    error: '',
    load: vi.fn(),
    state: {
      connection: {
        id: 'connection-1',
        repositoryUrl: 'https://github.com/example/service',
        provider: 'github',
        visibility: 'public',
        credentialSource: 'none',
        selectedBranch: 'main',
        commitSha: 'a'.repeat(40),
        status: 'connected',
      },
      canonicalIdentity: null,
    },
  } as unknown as RepositoryAnalysisHook;
}
