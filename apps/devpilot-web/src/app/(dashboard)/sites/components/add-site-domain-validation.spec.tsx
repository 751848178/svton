// @vitest-environment jsdom

/**
 * DOM-1/DOM-2 focused spec：添加域名入口表单的 required + 域名格式校验。
 * - DOM-1 非法域名（如 not_a_valid_domain!!）必须以内联错误阻止提交。
 * - DOM-2 空表单点「添加」必须出现字段级与表单级提示，而非静默。
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findInvalidAlias,
  isValidDomainName,
  validatePrimaryDomain,
} from '../domain-format.utils';
import { AddSiteModal } from './add-site-modal';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const api = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiRequest: (...args: unknown[]) => api.request(...args),
}));

vi.mock('@/components/ui/feedback/feedback', () => ({
  feedback: { success: vi.fn(), error: vi.fn() },
}));

function setNativeValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('domain format rules (DOM-1)', () => {
  it.each([
    ['app.example.com', true],
    ['pic-share.example.co', true],
    ['x.io', true],
    ['*.example.com', true],
    ['APP.Example.COM', true],
    ['not_a_valid_domain!!', false],
    ['-bad.example.com', false],
    ['bad-.example.com', false],
    ['example', false],
    ['example.c', false],
    ['a..b', false],
    ['', false],
  ])('%s -> %s', (value, expected) => {
    expect(isValidDomainName(value)).toBe(expected);
  });

  it('primary domain distinguishes required vs invalid; aliases report the first bad value', () => {
    expect(validatePrimaryDomain('')).toBe('required');
    expect(validatePrimaryDomain('not_a_valid_domain!!')).toBe('invalid');
    expect(validatePrimaryDomain('ok.example.com')).toBeNull();
    expect(findInvalidAlias('www.example.com, bad!!')).toBe('bad!!');
    expect(findInvalidAlias('www.example.com')).toBeNull();
  });
});

describe('AddSiteModal validation feedback (DOM-1/DOM-2)', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api.request.mockReset();
    api.request.mockResolvedValue({});
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function renderModal() {
    return act(async () => {
      root.render(
        <AddSiteModal
          servers={[]}
          projects={[{ id: 'project-1', name: 'Picshare' }]}
          projectEnvironments={[
            { id: 'env-dev', projectId: 'project-1', key: 'dev', name: '开发', status: 'active' },
          ]}
          proxyConfigs={[]}
          defaultProjectId="project-1"
          defaultEnvironmentId="env-dev"
          lockedContext={{ projectName: 'Picshare', environmentName: '开发' }}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );
    });
  }

  function inputByLabel(labelText: string) {
    const label = [...container.querySelectorAll('label')].find((item) =>
      item.textContent?.includes(labelText),
    );
    expect(label).toBeTruthy();
    return container.querySelector<HTMLInputElement>(`#${label!.htmlFor}`)!;
  }

  function clickAdd() {
    const add = [...container.querySelectorAll('button')].find((item) =>
      item.textContent === 'add',
    );
    expect(add).toBeTruthy();
    return act(async () => {
      add!.click();
    });
  }

  it('DOM-2: 空表单点「添加」给出字段级与表单级提示，且不发请求', async () => {
    await renderModal();
    await clickAdd();
    const alerts = [...container.querySelectorAll('[role="alert"]')].map(
      (item) => item.textContent,
    );
    expect(alerts).toContain('siteNameRequired');
    expect(alerts).toContain('primaryDomainRequired');
    expect(container.textContent).toContain('formIncompleteHint');
    expect(api.request).not.toHaveBeenCalled();
  });

  it('DOM-1: not_a_valid_domain!! 以内联格式错误阻止提交', async () => {
    await renderModal();
    await act(async () => {
      setNativeValue(inputByLabel('siteName'), '用户端');
      setNativeValue(inputByLabel('primaryDomain'), 'not_a_valid_domain!!');
    });
    await clickAdd();
    const alerts = [...container.querySelectorAll('[role="alert"]')].map(
      (item) => item.textContent,
    );
    expect(alerts).toContain('primaryDomainInvalid');
    expect(
      container.querySelector('#site-primary-domain-input')!.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(api.request).not.toHaveBeenCalled();
  });

  it('DOM-1: 非法别名以内联错误指出具体值', async () => {
    await renderModal();
    await act(async () => {
      setNativeValue(inputByLabel('siteName'), '用户端');
      setNativeValue(inputByLabel('primaryDomain'), 'app.example.com');
      setNativeValue(inputByLabel('domainAliases'), 'www.example.com, bad_domain!!');
    });
    await clickAdd();
    expect(container.textContent).toContain(
      'domainAliasInvalid:{"value":"bad_domain!!"}',
    );
    expect(api.request).not.toHaveBeenCalled();
  });

  it('合法输入仍走原有创建请求；修正后错误即时消失', async () => {
    await renderModal();
    await act(async () => {
      setNativeValue(inputByLabel('siteName'), '用户端');
      setNativeValue(inputByLabel('primaryDomain'), 'not_a_valid_domain!!');
    });
    await clickAdd();
    expect(container.textContent).toContain('primaryDomainInvalid');

    await act(async () => {
      setNativeValue(inputByLabel('primaryDomain'), 'app.example.com');
    });
    expect(container.textContent).not.toContain('primaryDomainInvalid');
    await clickAdd();
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request.mock.calls[0][1]).toMatchObject({ primaryDomain: 'app.example.com' });
  });
});
