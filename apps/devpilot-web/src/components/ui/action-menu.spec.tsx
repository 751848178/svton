// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './action-menu';

describe('ActionMenu focus target contract', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('passes the stable overflow trigger to a dialog-opening action', async () => {
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <ActionMenu
          triggerLabel="more target actions"
          groups={[{ items: [{ key: 'remove', label: 'remove', onSelect }] }]}
        />,
      ),
    );
    const trigger = container.querySelector('button')!;
    await act(async () => trigger.click());
    const item = document.body.querySelector('[role="menuitem"]') as HTMLButtonElement;
    await act(async () => item.click());
    expect(onSelect).toHaveBeenCalledWith(trigger);
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
