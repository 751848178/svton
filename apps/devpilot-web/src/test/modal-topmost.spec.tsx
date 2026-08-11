// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../../../../packages/ui/src/components/Modal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.style.overflow = '';
});

const settleFocus = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
});

describe('Modal topmost focus ownership', () => {
  it('lets only the top overlay close and keeps body locked until the stack empties', async () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    await act(async () => root.render(<>
      <Modal open onClose={closeFirst} title="First"><button>First action</button></Modal>
      <Modal open onClose={closeSecond} title="Second"><button>Second action</button></Modal>
    </>));
    await settleFocus();
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
    expect(dialogs).toHaveLength(2);
    expect(dialogs[0].getAttribute('aria-hidden')).toBe('true');
    expect(dialogs[1].dataset.overlayTopmost).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closeSecond).toHaveBeenCalledTimes(1);
    expect(closeFirst).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('contains focus and skips disabled or hidden controls in the top modal', async () => {
    await act(async () => root.render(<Modal open onClose={vi.fn()} title="Focus">
      <button>First enabled</button>
      <button>Last enabled</button>
      <button disabled>Disabled</button>
      <button style={{ display: 'none' }}>Hidden</button>
    </Modal>));
    await settleFocus();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const panel = dialog.querySelector<HTMLElement>('[tabindex="-1"]')!;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    const first = buttons.find((button) => button.getAttribute('aria-label') === 'Close')!;
    const last = buttons.find((button) => button.textContent === 'Last enabled')!;
    expect(document.activeElement).toBe(panel);
    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.activeElement).toBe(first);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.activeElement).toBe(first);
    outside.remove();
  });
});
