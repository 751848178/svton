// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentSettingsArea } from './environment-settings-area';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({ EmptyState: ({ text }: { text: string }) => <div>{text}</div> }));
vi.mock('@/components/ui', () => ({
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));
vi.mock('./environment-settings-detail', () => ({
  EnvironmentSettingsDetail: ({ environment }: { environment: { key: string } }) => (
    <div data-testid="environment-detail">detail:{environment.key}</div>
  ),
}));

describe('EnvironmentSettingsArea existing-environment configuration', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    mocks.searchParams = new URLSearchParams();
    mocks.replace.mockReset();
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders a single existing-environment selector and no create action', () => {
    const html = renderToStaticMarkup(<EnvironmentSettingsArea detail={detail()} />);
    expect(html).toContain('projectConfigurationTitle');
    expect(html).toContain('currentEnvironmentLabel');
    expect(html).toContain('Staging (staging)');
    expect(html).toContain('Production (production)');
    expect(html).toContain('detail:production');
    expect(html).not.toContain('envCreateAction');
  });

  it('restores and switches only an existing environment through the settings route', async () => {
    mocks.searchParams = new URLSearchParams('env=production');
    await act(async () => root.render(<EnvironmentSettingsArea detail={detail()} />));
    const select = container.querySelector('select')!;
    expect(select.value).toBe('production');
    await act(async () => {
      select.value = 'staging';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1/settings?env=staging&section=environments',
      { scroll: false },
    );
  });
});

function detail() {
  return {
    project: {
      id: 'project-1',
      environments: [
        {
          id: 'staging-1',
          key: 'staging',
          name: 'Staging',
          status: 'active',
          baselineRole: 'staging',
        },
        {
          id: 'production-1',
          key: 'production',
          name: 'Production',
          status: 'active',
          baselineRole: 'production',
        },
        { id: 'archived-1', key: 'old', name: 'Old', status: 'archived' },
      ],
    },
  } as never;
}
