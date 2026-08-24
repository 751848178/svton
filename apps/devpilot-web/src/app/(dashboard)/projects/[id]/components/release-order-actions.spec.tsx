// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseOrderActions } from './release-order-actions';

describe('ReleaseOrderActions overflow', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows three actions directly and reveals only overflow on hover', async () => {
    const actions = ['详情', '构建', '部署', '技术证据'].map((label) => ({
      key: label,
      label,
      onSelect: vi.fn(),
    }));
    await act(async () =>
      root.render(
        <ReleaseOrderActions
          actions={actions}
          moreLabel="更多"
        />,
      ),
    );
    expect(container.textContent).not.toContain('技术证据');
    const trigger = container.querySelector('[aria-haspopup="menu"]')!;
    await act(async () => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('技术证据');
    await act(async () =>
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })),
    );
    expect(document.activeElement?.textContent).toBe('技术证据');
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(document.body.textContent).not.toContain('技术证据');
    await act(async () => trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true })));
    await act(async () =>
      trigger.parentElement!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })),
    );
    expect(document.body.textContent).toContain('技术证据');
  });

  it('enters overflow with arrow keys and restores focus after Escape', async () => {
    const actions = ['详情', '构建', '部署', '技术证据', '审计记录'].map((label) => ({
      key: label,
      label,
      onSelect: vi.fn(),
    }));
    await act(async () =>
      root.render(
        <ReleaseOrderActions
          actions={actions}
          moreLabel="更多"
        />,
      ),
    );
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    trigger.focus();
    await act(async () =>
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })),
    );
    expect(document.activeElement?.textContent).toBe('技术证据');
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    expect(document.activeElement?.textContent).toBe('审计记录');
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(document.body.textContent).not.toContain('技术证据');
    expect(document.activeElement).toBe(trigger);
  });

  it('does not render a more trigger for three or fewer actions', async () => {
    const actions = ['详情', '构建', '部署'].map((label) => ({
      key: label,
      label,
      onSelect: vi.fn(),
    }));
    await act(async () =>
      root.render(
        <ReleaseOrderActions
          actions={actions}
          moreLabel="更多"
        />,
      ),
    );
    expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });
});
