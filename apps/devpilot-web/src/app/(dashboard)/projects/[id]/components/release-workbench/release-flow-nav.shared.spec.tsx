// @vitest-environment jsdom

/** PX-10：步骤条完成态（completed）必须与链路 done 同渲染 CheckCircle。 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { FlowNodeIcon } from './release-flow-nav.shared';

describe('FlowNodeIcon (PX-10)', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders completed and done identically (CheckCircle), distinct from current', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const { act } = await import('react');
    await act(async () =>
      root.render(
        <div>
          <span data-a>
            <FlowNodeIcon state="completed" />
          </span>
          <span data-b>
            <FlowNodeIcon state="done" />
          </span>
          <span data-c>
            <FlowNodeIcon state="current" />
          </span>
        </div>,
      ),
    );
    const completed = container.querySelector('[data-a] svg')!.innerHTML;
    const done = container.querySelector('[data-b] svg')!.innerHTML;
    const current = container.querySelector('[data-c] svg')!.innerHTML;
    expect(completed).toBe(done);
    expect(completed).not.toBe(current);
    await act(async () => root.unmount());
  });
});
