// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsVariableEditorModal } from './settings-variable-editor-modal';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Modal: (props: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    props.open ? (
      <section
        role="dialog"
        aria-label={props.title}
      >
        {props.children}
        {props.footer}
      </section>
    ) : null,
}));
vi.mock('../environment-plain-vars-editor', () => ({
  EnvironmentPlainVarsEditor: ({ onImportEnv }: { onImportEnv: () => void }) => (
    <button onClick={onImportEnv}>import-env</button>
  ),
}));
vi.mock('./settings-env-requirement-suggestions', () => ({
  SettingsEnvRequirementSuggestions: () => null,
}));
vi.mock('./settings-secret-reference-editor', () => ({
  SettingsSecretReferenceEditor: () => null,
}));

describe('SettingsVariableEditorModal', () => {
  let root: Root;
  let container: HTMLDivElement;
  const onSetDraft = vi.fn();
  const onReferencesChange = vi.fn();
  const onCopy = vi.fn();
  const onImportEnv = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    onSetDraft.mockReset();
    onReferencesChange.mockReset();
    onCopy.mockReset();
    onImportEnv.mockReset();
  });

  afterEach(async () => act(async () => root.unmount()));

  it('moves cross-environment copy inside the editor and closes before opening that flow', async () => {
    await render();
    await click('envVarsEditBindings');
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await click('envVarsCopyButton');
    expect(onCopy).toHaveBeenCalledWith(expect.any(HTMLElement));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('restores the plain and secret snapshots when cancelled', async () => {
    await render();
    await click('envVarsEditBindings');
    await click('cancel');
    expect(onSetDraft).toHaveBeenCalledWith({ API_URL: 'https://example.test' });
    expect(onReferencesChange).toHaveBeenCalledWith([{ id: 'secret-1', targetEnvKey: 'TOKEN' }]);
  });

  it('closes the editor before opening the .env import flow', async () => {
    await render();
    await click('envVarsEditBindings');
    await click('import-env');
    expect(onImportEnv).toHaveBeenCalledWith(expect.any(HTMLElement));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  async function render() {
    await act(async () =>
      root.render(
        <SettingsVariableEditorModal
          rows={[['API_URL', 'https://example.test']]}
          saving={false}
          suggestions={[]}
          secrets={[]}
          references={[{ id: 'secret-1', targetEnvKey: 'TOKEN' }]}
          revision={null}
          onSetDraft={onSetDraft}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
          onUpdate={vi.fn()}
          onImportEnv={onImportEnv}
          onSave={vi.fn()}
          onReferencesChange={onReferencesChange}
          onUsePlain={vi.fn()}
          onUseSecret={vi.fn()}
          copyDisabled={false}
          onCopy={onCopy}
        />,
      ),
    );
  }

  async function click(label: string) {
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent === label,
    );
    expect(button).toBeTruthy();
    await act(async () => button!.click());
  }
});
