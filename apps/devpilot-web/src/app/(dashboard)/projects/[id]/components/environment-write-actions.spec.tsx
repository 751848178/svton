// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentWriteActions } from './environment-write-actions';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  archive: vi.fn(),
  bindServer: vi.fn(),
  unbindServer: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@svton/ui', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => unknown; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));
vi.mock('@/components/ui', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) => (
    <div>{open ? <button onClick={onConfirm}>confirm-archive</button> : 'confirm-dialog'}</div>
  ),
  Field: ({ label, children }: { label?: React.ReactNode; children: React.ReactNode }) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  Select: ({ value, onChange, options }: { value: string; onChange: (e: { target: { value: string } }) => void; options: Array<{ value: string; label: string }> }) => (
    <select value={value} onChange={(e) => onChange({ target: { value: e.target.value } })}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));
vi.mock('@/components/ui/feedback/feedback', () => ({
  feedback: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../hooks/use-environment-actions', () => ({
  useEnvironmentActions: () => ({
    acting: false,
    update: mocks.update,
    archive: mocks.archive,
    bindServer: mocks.bindServer,
    unbindServer: mocks.unbindServer,
  }),
}));
vi.mock('./environment-bind-server-block', () => ({
  BindServerBlock: () => <div>bind-server-block</div>,
}));

describe('EnvironmentWriteActions F444 identity lifecycle', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.update.mockReset().mockResolvedValue(true);
    mocks.archive.mockReset().mockResolvedValue(true);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('baseline env: no archive affordance, edit = name + description + reason, no status select', async () => {
    const html = renderToStaticMarkup(
      <EnvironmentWriteActions environment={baselineEnv()} onSaved={() => undefined} />,
    );
    expect(html).not.toContain('envArchive');
    expect(html).not.toContain('envArchiveTitle');

    await renderActions();
    const edit = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('envEdit'),
    )!;
    await act(async () => edit.click());

    const form = container.innerHTML;
    expect(form).toContain('envNameLabel');
    expect(form).toContain('envDescriptionLabel');
    expect(form).toContain('envIdentityReasonLabel');
    expect(form).not.toContain('envStatusLabel');
    expect(form).not.toContain('envArchive');
  });

  it('description edit saves through the revision-based identity update with reason', async () => {
    await renderActions();
    const edit = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('envEdit'),
    )!;
    await act(async () => edit.click());

    const textareas = [...container.querySelectorAll('textarea')];
    const description = textareas[0];
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(description, '预发验证环境');
      description.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const reason = container.querySelector('input[placeholder="envIdentityReasonPlaceholder"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(reason, '演示对齐改名');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('envSave'),
    )!;
    await act(async () => save.click());

    expect(mocks.update).toHaveBeenCalledWith({
      name: 'Staging',
      description: '预发验证环境',
      reason: '演示对齐改名',
    });
  });

  it('non-baseline env keeps status select and archive affordance', async () => {
    const html = renderToStaticMarkup(
      <EnvironmentWriteActions environment={customEnv()} onSaved={() => undefined} />,
    );
    expect(html).toContain('envArchive');
  });

  it('renders the environment description in read mode', () => {
    const withDescription = {
      ...baselineEnv(),
      description: '预发验证环境',
    } as never;
    const html = renderToStaticMarkup(
      <EnvironmentWriteActions environment={withDescription} onSaved={() => undefined} />,
    );    expect(html).toContain('预发验证环境');
  });

  async function renderActions() {
    await act(async () =>
      root.render(<EnvironmentWriteActions environment={baselineEnv()} onSaved={() => undefined} />),
    );
  }
});

function baselineEnv() {
  return {
    id: 'env-staging',
    key: 'staging',
    name: 'Staging',
    status: 'active',
    sortOrder: 10,
    baselineRole: 'staging' as const,
    identityLockedAt: '2026-07-01T00:00:00Z',
    currentConfigRevisionId: 'rev-3',
    serverBindings: [],
    _count: { serverBindings: 0, sites: 0, deploymentRuns: 5, managedResources: 0, resourceRequests: 0, resourceInstances: 0, cdnConfigs: 0, secretKeys: 0 },
  };
}

function customEnv() {
  return {
    id: 'env-preview',
    key: 'preview',
    name: 'Preview',
    status: 'active',
    sortOrder: 10,
    baselineRole: null,
    identityLockedAt: null,
    currentConfigRevisionId: null,
    serverBindings: [],
    _count: { serverBindings: 0, sites: 0, deploymentRuns: 0, managedResources: 0, resourceRequests: 0, resourceInstances: 0, cdnConfigs: 0, secretKeys: 0 },
  };
}
