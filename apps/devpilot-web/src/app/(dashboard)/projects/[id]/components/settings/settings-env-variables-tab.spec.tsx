import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvVariablesTab } from './settings-env-variables-tab';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('../../hooks/use-environment-env-copy', () => ({
  useEnvironmentEnvCopy: () => ({ copying: false, copy: vi.fn() }),
}));
vi.mock('../../hooks/use-resource-instance-injections', () => ({
  useResourceInstanceInjections: () => [],
}));
vi.mock('./settings-subtab-shell', () => ({
  SubtabShell: (props: { actions: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <header>{props.actions}</header>
      <main>{props.children}</main>
    </section>
  ),
}));
vi.mock('./settings-variable-editor-modal', () => ({
  SettingsVariableEditorModal: () => <button>envVarsEditBindings</button>,
}));
vi.mock('../environment-env-vars-table', () => ({
  EnvironmentEnvVarsTable: () => <div>environment-vars-table</div>,
}));
vi.mock('../environment-config-revision-history', () => ({
  EnvironmentConfigRevisionHistory: () => <div>revision-history</div>,
}));
vi.mock('../environment-env-import-modal', () => ({ EnvironmentEnvImportModal: () => null }));
vi.mock('../environment-env-copy-dialog', () => ({ EnvironmentEnvCopyDialog: () => null }));
vi.mock('./settings-variable-collision-alert', () => ({
  SettingsVariableCollisionAlert: () => null,
}));

describe('EnvVariablesTab action hierarchy', () => {
  it('keeps one variable editor in the subtab header and the body read-only', () => {
    const html = renderToStaticMarkup(
      <EnvVariablesTab
        environment={{ id: 'env-1', config: { envVars: {} } } as never}
        detail={{ project: { id: 'project-1', applications: [], secretKeys: [] } } as never}
        plainVariables={{}}
        onPlainVariablesChange={vi.fn()}
        secretReferences={[]}
        onSecretReferencesChange={vi.fn()}
        resources={[]}
        revision={null}
        revisions={[]}
        environments={[]}
      />,
    );
    expect(html.match(/envVarsEditBindings/g)).toHaveLength(1);
    expect(html.indexOf('envVarsEditBindings')).toBeLessThan(
      html.indexOf('environment-vars-table'),
    );
    expect(html).not.toContain('envVarsCopyButton');
  });
});
