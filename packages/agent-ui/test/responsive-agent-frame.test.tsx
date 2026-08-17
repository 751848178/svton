import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveAgentFrame } from '../src/components/layout/ResponsiveAgentFrame';
import { Sidebar } from '../src/components/layout/Sidebar';
import type { SessionManagementActions } from '../src/components/layout/sidebar.types';

const managementActions: SessionManagementActions = {
  rename: async () => ({ ok: true }),
  setPinned: async () => ({ ok: true }),
  archive: async () => ({ ok: true }),
  stopAndArchive: async () => ({ ok: true }),
  unarchive: async () => ({ ok: true }),
  deletePermanently: async () => {},
};

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function frame() {
  return (
    <ResponsiveAgentFrame
      sidebarTitle="Navigation"
      navigationLabel="Open navigation"
      header={<div data-testid="session-titlebar"><button aria-label="Pop out session">Session alpha</button></div>}
      compactHeader={<div data-testid="session-titlebar"><button aria-label="Pop out session">Session alpha</button></div>}
      sidebar={(
        <Sidebar
          config={{
            title: 'Navigation',
            items: [{ id: 'chat', label: 'Conversation', view: 'chat' }],
            collapseStorageKey: 'responsive-test-collapse',
          }}
          activeView="chat"
          onNavigate={() => {}}
          sessions={[{
            id: 'alpha', title: 'Alpha session', management: {
              sessionId: 'alpha', isPinned: false, isArchived: false,
              isRunning: false, commands: ['rename', 'pin', 'archive', 'delete'],
            },
          }]}
          currentSessionId="alpha"
          onNewChat={() => {}}
          onSwitchSession={() => {}}
          managementActions={managementActions}
        />
      )}
    >
      <div>Conversation content</div>
    </ResponsiveAgentFrame>
  );
}

afterEach(() => {
  localStorage.clear();
});

describe('responsive agent frame', () => {
  it('keeps a persisted collapsed preference expanded inside the compact drawer', async () => {
    setViewport(390);
    localStorage.setItem('responsive-test-collapse', 'true');
    const user = userEvent.setup();
    render(frame());
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Navigation' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Conversation' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /^Alpha session\./ })).toBeVisible();
    expect(screen.getAllByText('Navigation')).toHaveLength(1);
    expect(screen.getAllByTestId('session-titlebar')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Pop out session' })).toHaveLength(1);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(localStorage.getItem('responsive-test-collapse')).toBe('true');
  });

  it('hydrates with the compact server snapshot before selecting the live viewport band', async () => {
    setViewport(1280);
    const container = document.createElement('div');
    container.innerHTML = renderToString(frame());
    document.body.append(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, frame()); });
    expect(container.querySelector('[data-responsive-band="wide"]')).not.toBeNull();
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/hydration|did not match/i);
    await act(async () => root.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  it('releases compact Escape ownership synchronously after geometry close in StrictMode', async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<React.StrictMode>{frame()}</React.StrictMode>);
    const navigationTrigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(navigationTrigger);
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    const manage = screen.getAllByRole('button', { name: /Alpha session/ }).at(-1)!;
    await user.click(manage);
    expect(screen.getByRole('menu')).toBeVisible();
    fireEvent.resize(window);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(manage).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(navigationTrigger).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(navigationTrigger).toHaveFocus());
  });
});
