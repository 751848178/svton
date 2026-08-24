// @vitest-environment jsdom

/**
 * SET-6 回归：资源引用「添加」按钮的启用条件必须可见、可达。
 * 契约：选中资源后——无模板变量的资源只需再选来源组件即可添加（确认步骤
 * 自动豁免）；有模板变量的资源还需确认映射；每一步禁用都给出文字原因；
 * 环境无组件时给出明确引导而不是永久静默禁用。
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentConfigResourceEditor } from './environment-config-resource-editor';
import type { Project, ProjectEnvironment } from '../types';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Select: (props: Record<string, unknown>) => <select {...(props as object)}>{(props as { children?: React.ReactNode }).children}</select>,
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  Modal: () => null,
}));
vi.mock('./environment-resource-binding-row-controls', () => ({
  EnvironmentResourceBindingRowControls: () => <div>row-controls</div>,
}));
vi.mock('./settings/settings-legacy-resource-binding-repair', () => ({
  SettingsLegacyResourceBindingRepair: () => null,
}));

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!
    .set!;
  setter.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('EnvironmentConfigResourceEditor add flow (SET-6)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    onChange = vi.fn();
  });
  afterEach(async () => act(async () => root.unmount()));

  const addButton = () =>
    [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('configReferenceAdd'),
    )!;
  const resourceSelect = () =>
    container.querySelector<HTMLSelectElement>('select[aria-label="configResourceSelect"]')!;
  // 预览面板里的「来源组件」下拉是页面第二个 select（无独立 aria-label）。
  const componentSelect = () =>
    [...container.querySelectorAll('select')].find(
      (select) => select.getAttribute('aria-label') !== 'configResourceSelect' &&
        [...select.options].some((option) => option.value === 'svc-1'),
    )!;

  async function renderEditor(projectOverride: Partial<Project> = {}) {
    await act(async () => {
      root.render(
        <EnvironmentConfigResourceEditor
          project={project(projectOverride)}
          environment={env()}
          value={[]}
          onChange={onChange}
          currentReferences={[]}
        />,
      );
    });
  }

  it('explains the disabled reason at each step and enables add for a template-less resource after component selection', async () => {
    await renderEditor();
    expect(addButton().disabled).toBe(true);
    expect(container.textContent).toContain('configResourceAddMissingResource');

    await act(async () => setSelectValue(resourceSelect(), 'site:site-1'));
    expect(addButton().disabled).toBe(true);
    expect(container.textContent).toContain('configResourceAddMissingComponent');
    // site 无模板变量：不渲染确认映射按钮（确认步骤豁免）。
    expect(container.textContent).not.toContain('envResourceConfirmMappings');

    await act(async () => setSelectValue(componentSelect(), 'svc-1'));
    expect(container.textContent).not.toContain('configResourceAddMissingComponent');
    expect(container.textContent).not.toContain('configResourceAddUnconfirmed');
    expect(addButton().disabled).toBe(false);

    await act(async () => addButton().click());
    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ kind: 'site', id: 'site-1', componentKey: 'svc-1' });
  });

  it('still requires explicit mapping confirmation for resources with template variables', async () => {
    await renderEditor();
    await act(async () => setSelectValue(resourceSelect(), 'resource_instance:inst-1'));
    await act(async () => setSelectValue(componentSelect(), 'svc-1'));
    expect(container.textContent).toContain('configResourceAddUnconfirmed');
    expect(addButton().disabled).toBe(true);

    const confirm = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('envResourceConfirmMappings'),
    )!;
    await act(async () => confirm.click());
    expect(addButton().disabled).toBe(false);
  });

  it('shows explicit guidance when the environment has no bindable components', async () => {
    await renderEditor({ applications: [] });
    await act(async () => setSelectValue(resourceSelect(), 'site:site-1'));
    expect(container.textContent).toContain('configResourceNoComponents');
    expect(addButton().disabled).toBe(true);
    expect(container.textContent).toContain('configResourceAddMissingComponent');
  });
});

function env(): ProjectEnvironment {
  return {
    id: 'env-staging',
    key: 'staging',
    name: 'Staging',
    status: 'active',
    sortOrder: 1,
    baselineRole: 'staging',
    identityLockedAt: null,
    currentConfigRevisionId: 'rev-1',
    serverBindings: [],
    _count: { serverBindings: 0, sites: 0, deploymentRuns: 0, managedResources: 0, resourceRequests: 0, resourceInstances: 0, cdnConfigs: 0, secretKeys: 0 },
  } as ProjectEnvironment;
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Picshare',
    environments: [env()],
    managedResources: [],
    resourceInstances: [
      {
        id: 'inst-1',
        name: 'picshare-mysql',
        resourceType: { envTemplate: 'DATABASE_URL=mysql://u:p@h/db\n' },
      },
    ],
    sites: [{ id: 'site-1', name: 'Picshare Site' }],
    cdnConfigs: [],
    applications: [
      {
        id: 'app-1',
        name: 'Picshare App',
        services: [
          {
            id: 'svc-1',
            name: 'backend',
            status: 'active',
            environment: { id: 'env-staging', key: 'staging', name: 'Staging' },
          },
        ],
      },
    ],
    ...overrides,
  } as unknown as Project;
}
