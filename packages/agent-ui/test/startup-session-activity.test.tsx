import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartupStateView } from '../src/components/feedback/StartupStateView';
import { SessionActivityIndicator } from '../src/components/layout/SessionActivityIndicator';
import { Sidebar } from '../src/components/layout/Sidebar';

describe('startup state view', () => {
  it('renders a retryable typed error and invokes retry in place', () => {
    const retry = vi.fn();
    render(<StartupStateView
      state={{ phase: 'error', source: 'session', cause: 'Session failed' }}
      onRetry={retry}
    />);
    expect(screen.getByRole('alert')).toHaveTextContent('Session failed');
    fireEvent.click(screen.getByTestId('startup-retry'));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('keeps no-configuration as a distinct user action state', () => {
    const configure = vi.fn();
    render(<StartupStateView
      state={{ phase: 'noConfiguration', source: 'config' }}
      onConfigure={configure}
    />);
    fireEvent.click(screen.getByTestId('startup-configure'));
    expect(configure).toHaveBeenCalledOnce();
  });
});

describe('session activity rows', () => {
  const activity = {
    phase: 'waitingOnApproval', isUnread: true,
    statusLabel: 'Needs approval', statusDescription: 'Waiting for tool approval',
  };

  it('exposes compact semantic status and stable attributes', () => {
    render(<SessionActivityIndicator sessionId="a" activity={activity} />);
    const status = screen.getByTestId('session-activity-a');
    expect(status).toHaveAttribute('data-phase', 'waitingOnApproval');
    expect(status).toHaveAttribute('data-unread', 'true');
    expect(status).toHaveAccessibleName('Needs approval, Unread');
  });

  it('hides a read terminal projected back to idle', () => {
    render(<SessionActivityIndicator sessionId="a" activity={{
      phase: 'idle', isUnread: false,
      statusLabel: 'Idle', statusDescription: 'Conversation is idle',
    }} />);
    expect(screen.queryByTestId('session-activity-a')).not.toBeInTheDocument();
  });

  it('keeps the shared session row keyboard reachable', () => {
    const onSwitch = vi.fn();
    render(<Sidebar
      config={{ items: [], showSettings: false, collapsible: false }}
      activeView="chat"
      onNavigate={() => {}}
      sessions={[{ id: 'a', title: 'Session A', activity }]}
      currentSessionId="b"
      onSwitchSession={onSwitch}
    />);
    const row = screen.getByRole('button', { name: /Session A/ });
    row.focus();
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.click(row);
    expect(onSwitch).toHaveBeenCalledOnce();
  });
});

void React;
