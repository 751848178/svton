// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import type { EnvironmentConfigRevisionList } from '../../types/environment-config-revision.types';
import { EnvironmentSettingsArea } from './environment-settings-area';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  save: vi.fn(),
  governance: {
    data: null as EnvironmentConfigRevisionList | null,
    current: null as EnvironmentConfigRevision | null,
    policies: [] as Array<{
      id: string;
      name: string;
      effect: string;
      enabled?: boolean;
      project?: { id: string } | null;
      environment?: { id: string } | null;
    }>,
    loading: false,
    saving: false,
    error: '',
    load: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => unknown;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  ConfirmDialog: () => <div>confirm-dialog</div>,
  Select: () => <div>select</div>,
  Modal: ({ open }: { open: boolean }) => (open ? <div>modal-open</div> : null),
}));
vi.mock('@/components/ui/feedback/feedback', () => ({
  feedback: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn().mockRejectedValue(new Error('api-client mocked')),
}));
vi.mock('@svton/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => unknown;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  EmptyState: ({ text }: { text: string }) => <div>{text}</div>,
  Modal: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title?: string;
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
  Textarea: () => <textarea readOnly />,
}));
vi.mock('../../hooks/use-resource-instance-injections', () => ({
  useResourceInstanceInjections: () => [],
}));
vi.mock('../../hooks/use-environment-config-governance', () => ({
  useEnvironmentConfigGovernance: () => mocks.governance,
}));
vi.mock('../../hooks/use-environment-actions', () => ({
  useEnvironmentActions: () => ({
    acting: false,
    update: vi.fn(),
    archive: vi.fn(),
    bindServer: vi.fn(),
    unbindServer: vi.fn(),
  }),
}));
vi.mock('../environment-bind-server-block', () => ({
  BindServerBlock: () => <div>bind-server-block</div>,
}));
vi.mock('../environment-env-vars-section', () => ({
  EnvironmentEnvVarsSection: () => <div>env-vars-section</div>,
}));
vi.mock('../environment-write-actions', () => ({
  EnvironmentWriteActions: () => <div>write-actions</div>,
}));
vi.mock('../environment-copy-panel', () => ({
  EnvironmentCopyPanel: () => <div>copy-panel</div>,
}));
vi.mock('../environment-sync-panel', () => ({
  EnvironmentSyncPanel: () => <div>sync-panel</div>,
}));
vi.mock('../environment-create-modal', () => ({
  EnvironmentCreateModal: () => <div>create-modal</div>,
}));

describe('EnvironmentSettingsArea Demo-aligned environment configuration', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.searchParams = new URLSearchParams();
    mocks.replace.mockReset();
    mocks.save.mockReset();
    mocks.governance = {
      data: {
        environmentId: 'env-staging',
        currentConfigRevisionId: 'rev-3',
        revisions: [revision('rev-3', 3, true), revision('rev-2', 2, false)],
      },
      current: revision('rev-3', 3, true),
      policies: [
        {
          id: 'p1',
          name: 'Production approval',
          effect: 'allow',
          enabled: true,
          project: null,
          environment: null,
        },
      ],
      loading: false,
      saving: false,
      error: '',
      load: vi.fn(),
      save: mocks.save,
    };
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders the env switcher, four-fact summary and config-revision strip', () => {
    const html = renderToStaticMarkup(<EnvironmentSettingsArea detail={detail()} />);

    expect(html).toContain('envManagementTitle');
    expect(html).toContain('envSwitchLabel');
    expect(html).toContain('staging · Staging');
    expect(html).toContain('production · Production');
    expect(html).toContain('envStatusActive');
    expect(html).toContain('envSummaryRole');
    expect(html).toContain('envRoleStaging');
    expect(html).toContain('envSummaryTarget');
    expect(html).toContain('envSummaryTargetValue');
    expect(html).toContain('envSummaryCurrentVersion');
    expect(html).toContain('envSummaryRuntimeHint');
    expect(html).toContain('envSummaryProtection');
    expect(html).toContain('envProtectionPolicies');
    expect(html).toContain('configRevisionStripLabel');
    expect(html).toContain('R3 · ');
    expect(html).toContain('configRevisionIdentityLabel');
    expect(html).toContain('configOrderLocked');
  });

  it('marks the URL-selected environment active and restores its subtab on refresh', () => {
    mocks.searchParams = new URLSearchParams('env=production&envTab=variables');
    const html = renderToStaticMarkup(<EnvironmentSettingsArea detail={detail()} />);

    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?production · Production/)).not.toBeNull();
    expect(html).toContain('envTabVariables');
    expect(html).toContain('envVarsSnapshotCallout');
    expect(html).toContain('envVarsCopyButton');
    expect(html).toContain('configRevisionHistoryTitle');
    expect(html).toContain('configSecretReferences');
  });

  it('shows the five Demo-aligned subtabs and no long config drawer', () => {
    const html = renderToStaticMarkup(<EnvironmentSettingsArea detail={detail()} />);

    for (const key of [
      'envTabTargets',
      'envTabResources',
      'envTabVariables',
      'envTabRoutes',
      'envTabProtection',
    ]) {
      expect(html).toContain(key);
    }
    expect(html).not.toContain('envDetailTitle');
    expect(html).not.toContain('envDetailLastDeployment');
  });

  it('keeps runtime state as clearly-labeled cross-reference links only', () => {
    const html = renderToStaticMarkup(<EnvironmentSettingsArea detail={detail()} />);

    expect(html).toContain('href="/projects/project-1?view=environment-versions"');
    expect(html).toContain('envViewVersions');
    expect(html).toContain('href="/projects/project-1?view=deployments"');
    expect(html).toContain('envViewDeployments');
    expect(html).toContain('envDeployRunCount');
  });

  it('persists env selection to the settings deep link on switcher click', async () => {
    await renderArea();
    const buttons = [...container.querySelectorAll('button')];
    const productionButton = buttons.find((button) =>
      button.textContent?.includes('production · Production'),
    )!;
    await act(async () => productionButton.click());
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1/settings?env=production&section=environments',
      { scroll: false },
    );
  });

  it('persists the exact subtab to the settings deep link on subtab click', async () => {
    await renderArea();
    const subtab = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('envTabRoutes'),
    )!;
    await act(async () => subtab.click());
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1/settings?env=staging&envTab=routes&section=environments',
      { scroll: false },
    );
  });

  it('hides the 新建环境 create affordance for governed projects (AC-SET-016)', async () => {
    const html = renderToStaticMarkup(<EnvironmentSettingsArea detail={detail()} />);

    expect(html).not.toContain('envCreateAction');
    expect(html).not.toContain('+ ');
  });

  it('keeps the create affordance for non-governed projects', async () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsArea detail={detailWithoutBaselines()} />,
    );

    expect(html).toContain('envCreateAction');
  });

  async function renderArea() {
    await act(async () => root.render(<EnvironmentSettingsArea detail={detail()} />));
  }
});

function detailWithoutBaselines() {
  return {
    loading: false,
    error: '',
    project: {
      id: 'project-1',
      name: 'Picshare',
      environments: [
        {
          id: 'env-preview',
          key: 'preview',
          name: 'Preview',
          status: 'active',
          sortOrder: 1,
          baselineRole: null,
          identityLockedAt: null,
          currentConfigRevisionId: null,
          serverBindings: [],
          _count: {
            serverBindings: 0,
            sites: 0,
            deploymentRuns: 0,
            managedResources: 0,
            resourceRequests: 0,
            resourceInstances: 0,
            cdnConfigs: 0,
            secretKeys: 0,
          },
        },
      ],
      sites: [],
      secretKeys: [],
    },
    deploymentRuns: [],
    loadProject: vi.fn(),
  } as never;
}

function revision(id: string, revision: number, current: boolean): EnvironmentConfigRevision {
  return {
    id,
    revision,
    snapshotHash: 'sha256:abc',
    plainVariables: {},
    secretReferences: [{ id: 's1', name: 'DB_PASSWORD', type: 'vault' }],
    resourceReferences: [],
    routeSnapshot: {
      domains: ['staging.picshare.example.com'],
      dnsProvider: 'cloudflare',
      tlsRequired: true,
      proxyTarget: 'web:3000',
    },
    policyReferences: [{ id: 'p1', name: 'Production approval', effect: 'allow', actions: {} }],
    source: 'manual',
    createdAt: '2026-07-30T18:20:00Z',
    current,
    createdBy: null,
  };
}

function detail() {
  return {
    loading: false,
    error: '',
    project: {
      id: 'project-1',
      name: 'Picshare',
      environments: [
        {
          id: 'env-staging',
          key: 'staging',
          name: 'Staging',
          status: 'active',
          sortOrder: 1,
          baselineRole: 'staging',
          identityLockedAt: '2026-07-01T00:00:00Z',
          currentConfigRevisionId: 'rev-3',
          serverBindings: [
            {
              id: 'b1',
              role: 'deploy',
              server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'active' },
            },
          ],
          _count: {
            serverBindings: 1,
            sites: 2,
            deploymentRuns: 5,
            managedResources: 1,
            resourceRequests: 0,
            resourceInstances: 2,
            cdnConfigs: 1,
            secretKeys: 1,
          },
        },
        {
          id: 'env-production',
          key: 'production',
          name: 'Production',
          status: 'active',
          sortOrder: 2,
          baselineRole: 'production',
          identityLockedAt: null,
          currentConfigRevisionId: null,
          serverBindings: [],
          _count: {
            serverBindings: 0,
            sites: 1,
            deploymentRuns: 9,
            managedResources: 2,
            resourceRequests: 0,
            resourceInstances: 3,
            cdnConfigs: 0,
            secretKeys: 2,
          },
        },
      ],
      sites: [],
      secretKeys: [],
    },
    deploymentRuns: [],
    loadProject: vi.fn(),
  } as never;
}
