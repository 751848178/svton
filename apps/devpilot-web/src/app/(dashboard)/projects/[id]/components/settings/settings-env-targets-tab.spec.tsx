import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvTargetsTab } from './settings-env-targets-tab';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  ConfirmDialog: () => null,
}));
vi.mock('../../hooks/use-environment-actions', () => ({
  useEnvironmentActions: () => ({
    acting: false,
    bindServer: vi.fn(),
    unbindServer: vi.fn(),
  }),
}));
vi.mock('./settings-subtab-shell', () => ({
  SubtabShell: (props: { actions: React.ReactNode; children: React.ReactNode }) => (
    <section>
      {props.actions}
      {props.children}
    </section>
  ),
}));
vi.mock('./settings-env-target-create-dialog', () => ({
  SettingsEnvTargetCreateDialog: () => null,
}));
vi.mock('./settings-env-target-edit-dialog', () => ({
  SettingsEnvTargetEditDialog: () => null,
  targetEditDraftFrom: vi.fn(),
}));

describe('EnvTargetsTab', () => {
  it('renders one deployment-target table and a target-specific create action', () => {
    const html = renderToStaticMarkup(
      <EnvTargetsTab
        environment={environment()}
        detail={detail()}
        targets={{
          data: { providerKey: null, currentTarget: null, bindings: [] },
          loading: false,
          error: '',
          reload: vi.fn(),
        }}
      />,
    );

    expect(html).toContain('envTargetCreate');
    expect(html).toContain('envTargetTableServer');
    expect(html).toContain('envTargetTableProvider');
    expect(html).toContain('envTargetsNone');
    expect(html).not.toContain('envBindServer');
  });
});

function environment() {
  return {
    id: 'env-1',
    key: 'production',
    name: 'Production',
    status: 'active',
    sortOrder: 1,
  } as never;
}

function detail() {
  return {
    project: { id: 'project-1', environments: [environment()] },
    loadProject: vi.fn(),
  } as never;
}
