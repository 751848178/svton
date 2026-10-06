// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseOrderCreateModal } from './release-order-create-modal';
import { RELEASE_VERSION_INPUT_PATTERN } from '../utils/release-version-display.model';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

// 薄透传 mock：保留 pattern/value/disabled 等真实 DOM 属性供断言。
vi.mock('@/components/ui', () => ({
  Modal: ({
    open,
    onClose,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        <button
          type="button"
          data-testid="modal-shell-close"
          onClick={onClose}
        >
          shell-close
        </button>
        {children}
      </div>
    ) : null,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));

function buildOrders(overrides: Record<string, unknown> = {}) {
  return {
    create: vi.fn(),
    creating: false,
    createError: '',
    ...overrides,
  } as unknown as ReleaseOrdersHook;
}

describe('ReleaseOrderCreateModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    onClose = vi.fn();
  });
  afterEach(async () => act(async () => root.unmount()));

  function render(orders?: ReleaseOrdersHook) {
    return act(async () => {
      root.render(
        <ReleaseOrderCreateModal
          open
          onClose={onClose}
          orders={orders ?? buildOrders()}
        />,
      );
    });
  }

  it('WIZ-1: the version input pattern accepts canonical versions like 99.0.0', async () => {
    await render();
    const input = container.querySelector<HTMLInputElement>('input[pattern]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('pattern')).toBe(RELEASE_VERSION_INPUT_PATTERN);
    // JSX 字符串属性不再出现双反斜杠：浏览器原生校验必须放行合法版本号。
    expect(input?.getAttribute('pattern')).not.toContain('\\\\.');
    const pattern = input!.getAttribute('pattern')!;
    expect(new RegExp(`^(?:${pattern})$`).test('99.0.0')).toBe(true);
    expect(new RegExp(`^(?:${pattern})$`).test('1.4.0')).toBe(true);
    expect(new RegExp(`^(?:${pattern})$`).test('99.0')).toBe(false);
    expect(new RegExp(`^(?:${pattern})$`).test('v99.0.0')).toBe(false);
  });

  function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('WIZ-4: an invalid non-empty version shows the inline format hint', async () => {
    await render();
    const versionInput = container.querySelector<HTMLInputElement>('input[pattern]');
    await act(async () => setInputValue(versionInput!, 'abc'));
    expect(container.textContent).toContain('releaseVersionFormatHint');
    expect(versionInput?.getAttribute('aria-invalid')).toBe('true');

    await act(async () => setInputValue(versionInput!, '99.0.0'));
    expect(container.textContent).not.toContain('releaseVersionFormatHint');
  });

  it('WIZ-4: an empty required field explains why the submit button is disabled', async () => {
    await render();
    const submit = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('createReleaseOrder'),
    );
    expect(submit?.disabled).toBe(true);
    expect(container.textContent).toContain('releaseVersionRequiredHint');
  });

  it('WIZ-3: a create failure renders the error inside the dialog', async () => {
    await render(buildOrders({ createError: 'boom-backend-4xx' }));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('boom-backend-4xx');
    expect(container.textContent).toContain('createReleaseOrderError');
  });

  it('disables the submit action while a create request is in flight', async () => {
    const orders = buildOrders();
    await render(orders);
    const versionInput = container.querySelector<HTMLInputElement>('input')!;
    await act(async () => setInputValue(versionInput, '2.4.1'));
    const submit = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('createReleaseOrder'),
    )!;
    expect(submit.disabled).toBe(false);

    await render(buildOrders({ creating: true }));
    expect(submit.disabled).toBe(true);
  });

  it('WIZ-5: cancel clears the staged inputs before closing', async () => {
    await render();
    const versionInput = container.querySelector<HTMLInputElement>('input[pattern]');
    await act(async () => setInputValue(versionInput!, '99.0.0'));
    const cancelButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('cancel'),
    );
    await act(async () => {
      cancelButton!.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(versionInput?.value).toBe('');
  });

  it('creates the minimum contract by deriving the internal name from the version', async () => {
    const orders = buildOrders({ create: vi.fn().mockResolvedValue({ id: 'order-1' }) });
    await render(orders);
    const versionInput = container.querySelector<HTMLInputElement>('input[pattern]')!;
    await act(async () => setInputValue(versionInput, '2.4.1'));
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(orders.create).toHaveBeenCalledWith({
      releaseName: '2.4.1',
      releaseVersion: '2.4.1',
    });
  });
});
