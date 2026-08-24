import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentTargetBindingRow } from './settings-env-target-rows';
import { renderEnvTab } from './settings-env-tab-switch';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./environment-version-config', () => ({
  EnvironmentVersionConfig: () => <div>version-config</div>,
}));
vi.mock('./settings-env-targets-tab', () => ({ EnvTargetsTab: () => <div>target-config</div> }));
vi.mock('./settings-env-resources-tab', () => ({
  EnvResourcesTab: () => <div>resource-config</div>,
}));
vi.mock('./settings-env-variables-tab', () => ({
  EnvVariablesTab: () => <div>variable-config</div>,
}));
vi.mock('./settings-env-access-tab', () => ({ EnvAccessTab: () => <div>access-config</div> }));
vi.mock('./settings-env-verification-tab', () => ({
  EnvVerificationTab: () => <div>verification-config</div>,
}));

describe('project configuration tabs', () => {
  it('shows deployment target facts in operator language', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <EnvironmentTargetBindingRow
            binding={{
              id: 'binding-1',
              role: 'deploy',
              status: 'active',
              createdAt: '',
              updatedAt: '',
              providerKey: 'ssh-v1',
              sharedEnvironmentIds: [],
              metadata: { releaseDeployment: { root: '/srv/picshare' } },
              server: { id: 'server-1', name: 'prod-web', host: '10.0.0.1', status: 'online' },
            }}
            isCurrent
            currentRoot="/srv/picshare"
            targetReady
            serverHref="/servers?serverId=server-1"
            t={((key: string) => key) as never}
            onAdjust={vi.fn()}
            onUnbind={vi.fn()}
          />
        </tbody>
      </table>,
    );
    expect(html).toContain('prod-web');
    expect(html).toContain('10.0.0.1');
    expect(html).toContain('ssh-v1');
    expect(html).toContain('/srv/picshare');
    expect(html).toContain('envTargetCredentialReady');
  });

  it('explains incomplete target facts and their release impact', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <EnvironmentTargetBindingRow
            binding={{
              id: 'binding-1',
              role: 'deploy',
              status: 'active',
              createdAt: '',
              updatedAt: '',
              providerKey: null,
              sharedEnvironmentIds: [],
              metadata: null,
              server: { id: 'server-1', name: 'prod-web', host: '10.0.0.1', status: 'offline' },
            }}
            isCurrent
            currentRoot={null}
            targetReady={false}
            serverHref="/servers?serverId=server-1"
            t={((key: string) => key) as never}
            onAdjust={vi.fn()}
            onUnbind={vi.fn()}
          />
        </tbody>
      </table>,
    );
    expect(html).toContain('envTargetMissingProvider');
    expect(html).toContain('envTargetMissingPath');
    expect(html).toContain('envTargetIssueImpact');
    expect(html).toContain('envTargetComplete');
    expect(html).toContain('envTargetCheckServer');
  });

  it.each([
    ['versions', 'version-config'],
    ['targets', 'target-config'],
    ['resources', 'resource-config'],
    ['variables', 'variable-config'],
    ['access', 'access-config'],
    ['verification', 'verification-config'],
  ] as const)('routes %s through the environment configuration owner', (tab, expected) => {
    expect(renderToStaticMarkup(renderEnvTab(tab, context()))).toContain(expected);
  });
});

function context() {
  return {
    detail: { project: { id: 'project-1' } },
    environment: { id: 'environment-1' },
    targets: {},
    secrets: [],
    setSecrets: vi.fn(),
    policyIds: [],
    setPolicyIds: vi.fn(),
    policies: [],
    resources: [],
    setResources: vi.fn(),
    route: {},
    setRoute: vi.fn(),
    observability: '',
    setObservability: vi.fn(),
    revision: null,
    revisions: [],
    environments: [],
  } as never;
}
