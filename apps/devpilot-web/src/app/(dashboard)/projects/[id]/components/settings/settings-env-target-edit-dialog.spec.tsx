// @vitest-environment jsdom

/**
 * F445 focused Web spec: 调整目标 revision-based edit surface (AC-SET-018/019).
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SettingsEnvTargetEditDialog,
  targetEditDraftFrom,
  type TargetEditDraft,
} from './settings-env-target-edit-dialog';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Modal: ({
    open,
    children,
    footer,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    title?: string;
  }) =>
    open ? (
      <div data-testid="target-edit-dialog" data-title={title}>
        {children}
        {footer}
      </div>
    ) : null,
  Select: ({ value, onChange, options, placeholder }: { value: string; onChange: (e: { target: { value: string } }) => void; options: Array<{ value: string; label: string }>; placeholder?: string }) => (
    <select
      data-testid="provider-select"
      value={value}
      onChange={(e) => onChange(e)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      {...props}
    />
  ),
}));
vi.mock('@svton/ui', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => unknown; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

describe('SettingsEnvTargetEditDialog (F445)', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    mocks.confirm.mockReset();
    mocks.confirm.mockResolvedValue(true);
  });

  afterEach(async () => act(async () => root.unmount()));

  const draft: TargetEditDraft = {
    bindingId: 'b1',
    serverId: 'server-1',
    serverName: 'stg-web',
    providerKey: 'ssh-v1',
    root: '/srv/app',
    targetRef: '',
    sharedEnvironmentIds: [],
  };

  it('offers ssh-v1 root editing and shared-scope checkboxes (isolation default)', async () => {
    await act(async () =>
      root.render(
        <SettingsEnvTargetEditDialog
          open
          draft={draft}
          otherEnvironments={[
            { id: 'env-prod', key: 'production', name: 'Production' },
          ]}
          onClose={() => undefined}
          onConfirm={mocks.confirm}
        />,
      ),
    );
    const html = container.innerHTML;
    expect(html).toContain('envTargetAdjustTitle');
    expect(html).toContain('envTargetProviderLabel');
    expect(html).toContain('envTargetRootLabel');
    expect(html).toContain('/srv/app');
    expect(html).toContain('envTargetSharedScopeLabel');
    expect(html).toContain('envTargetSharedScopeHint');
    expect(html).toContain('Production');
  });

  it('sends providerKey/root/sharedEnvironmentIds through the audited bind save', async () => {
    await act(async () =>
      root.render(
        <SettingsEnvTargetEditDialog
          open
          draft={draft}
          otherEnvironments={[
            { id: 'env-prod', key: 'production', name: 'Production' },
          ]}
          onClose={() => undefined}
          onConfirm={mocks.confirm}
        />,
      ),
    );
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    await act(async () => {
      const save = [...container.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('envTargetAdjustSave'),
      );
      save?.click();
    });

    expect(mocks.confirm).toHaveBeenCalledWith({
      providerKey: 'ssh-v1',
      root: '/srv/app',
      targetRef: undefined,
      sharedEnvironmentIds: ['env-prod'],
    });
  });

  it('switches to the target-reference field for non-ssh providers', async () => {
    await act(async () =>
      root.render(
        <SettingsEnvTargetEditDialog
          open
          draft={{ ...draft, providerKey: 'local-filesystem-v1' }}
          otherEnvironments={[]}
          onClose={() => undefined}
          onConfirm={mocks.confirm}
        />,
      ),
    );
    expect(container.innerHTML).toContain('envTargetRefLabel');
    expect(container.innerHTML).not.toContain('envTargetRootLabel');
  });

  it('SET-5: a provider-less binding shows the unselected placeholder, a save reason, and becomes savable after picking a provider', async () => {
    await act(async () =>
      root.render(
        <SettingsEnvTargetEditDialog
          open
          draft={{ ...draft, providerKey: '', root: '', targetRef: '' }}
          otherEnvironments={[]}
          onClose={() => undefined}
          onConfirm={mocks.confirm}
        />,
      ),
    );
    const select = container.querySelector<HTMLSelectElement>('[data-testid="provider-select"]')!;
    // 受控 select 的空值必须以 placeholder 选项可见，而不是伪装成已选 SSH。
    expect(select.value).toBe('');
    expect(
      [...select.options].some((option) => option.value === '' && option.textContent === 'envTargetProviderPlaceholder'),
    ).toBe(true);
    const save = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('envTargetAdjustSave'),
    )!;
    expect(save.disabled).toBe(true);
    expect(container.textContent).toContain('envTargetProviderRequiredHint');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!
        .set!;
      setter.call(select, 'ssh-v1');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(select.value).toBe('ssh-v1');
    expect(save.disabled).toBe(false);
    expect(container.textContent).not.toContain('envTargetProviderRequiredHint');
  });
});

describe('targetEditDraftFrom (F445)', () => {
  it('maps the provider-matched current target ref onto the binding draft', () => {
    const draft = targetEditDraftFrom(
      {
        id: 'b1',
        role: 'deploy',
        status: 'active',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
        providerKey: 'ssh-v1',
        sharedEnvironmentIds: ['env-prod'],
        metadata: { releaseDeployment: { providerKey: 'ssh-v1', root: '/srv/app' } },
        server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'online' },
      },
      {
        bindingId: 'b1',
        serverId: 'server-1',
        providerKey: 'ssh-v1',
        targetRef: 'ssh://deploy@10.0.0.1:22/srv/app',
        root: '/srv/app',
        server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'online' },
        sharedEnvironmentIds: [],
        versionHash: 'a'.repeat(64),
      },
    );

    expect(draft).toEqual({
      bindingId: 'b1',
      serverId: 'server-1',
      serverName: 'stg-web',
      providerKey: 'ssh-v1',
      root: '/srv/app',
      targetRef: 'ssh://deploy@10.0.0.1:22/srv/app',
      sharedEnvironmentIds: ['env-prod'],
    });
  });
});
