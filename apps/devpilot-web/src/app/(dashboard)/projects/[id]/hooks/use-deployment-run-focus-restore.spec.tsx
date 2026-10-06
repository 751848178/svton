// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDeploymentRunFocusRestore } from './use-deployment-run-focus-restore';

describe('useDeploymentRunFocusRestore', () => {
  afterEach(() => vi.useRealTimers());

  it('focuses the remounted exact trigger after runId leaves the URL', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    let close: () => void = () => undefined;

    function Harness() {
      const [runId, setRunId] = useState<string>();
      const restore = useDeploymentRunFocusRestore(runId);
      close = () => setRunId(undefined);
      return (
        <button
          key={runId ?? 'list'}
          data-deployment-run-trigger="run-1:evidence"
          onClick={(event) => {
            restore.remember(event.currentTarget);
            setRunId('run-1');
          }}
        >
          evidence
        </button>
      );
    }

    await act(async () => root.render(<Harness />));
    await act(async () => container.querySelector('button')?.click());
    await act(async () => close());
    await act(async () => vi.advanceTimersByTime(300));
    expect(document.activeElement).toBe(container.querySelector('button'));
    await act(async () => root.unmount());
    container.remove();
  });
});
