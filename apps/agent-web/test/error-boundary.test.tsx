import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

describe('Web ErrorBoundary', () => {
  it('renders the shared localized error state and retries the child tree', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let broken = true;
    function Child() {
      if (broken) throw new Error('Visible failure');
      return <p>Restored child</p>;
    }

    await act(async () => {
      root.render(<ErrorBoundary><Child /></ErrorBoundary>);
    });
    expect(container.textContent).toContain('Error');
    expect(container.textContent).toContain('Run failed. Review the visible error details.');
    expect(container.textContent).not.toContain('Visible failure');
    const icon = container.querySelector('svg');
    expect(icon?.classList.contains('lucide-triangle-alert')).toBe(true);
    expect(icon?.getAttribute('aria-hidden')).toBe('true');

    broken = false;
    const retry = container.querySelector('button');
    expect(retry?.textContent).toBe('Retry');
    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Restored child');
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleError.mockRestore();
  });
});
