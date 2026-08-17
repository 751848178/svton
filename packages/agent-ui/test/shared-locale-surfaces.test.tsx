import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleProvider, type Locale } from '@svton/ui';
import { StartupStateView } from '../src/components/feedback/StartupStateView';
import { ToolApprovalModal } from '../src/components/chat/ToolApprovalModal';
import { UserInputForm } from '../src/components/chat/UserInputForm';
import { SidebarSessionList } from '../src/components/layout/SidebarSessionList';
import { SessionManagementMenu } from '../src/components/layout/SessionManagementMenu';
import type { ApprovalRequestView } from '../src/components/chat/approval.types';
import type { UserInputRequestView } from '../src/components/chat/user-input.types';

const approval: ApprovalRequestView = {
  requestId: 'approval-1', sessionId: 'session-1', itemId: 'item-1', createdAt: 1,
  toolName: 'bash', arguments: { command: 'pwd' }, decisions: ['accept', 'decline'],
};
const question: UserInputRequestView = {
  requestId: 'input-1', sessionId: 'session-1', state: 'pending',
  questions: [{
    id: 'answer', header: 'Answer', question: 'Choose.', isOther: false,
    isSecret: false, options: [{ label: 'Yes', description: 'Continue.' }],
  }],
};

function localized(locale: Locale, child: React.ReactNode) {
  return render(<LocaleProvider locale={locale}>{child}</LocaleProvider>);
}

describe.each([
  ['en', 'Configuration required', 'Manage Alpha', 'Needs approval, Unread'],
  ['zh', '需要配置', '管理 Alpha', '需要批准, 未读'],
] as const)('shared locale surfaces (%s)', (locale, startup, manage, activity) => {
  it('projects startup, session activity AX copy, and menu commands', () => {
    const startupView = localized(locale, <StartupStateView
      state={{ phase: 'noConfiguration', source: 'config' }} onConfigure={vi.fn()}
    />);
    expect(screen.getByRole('heading', { name: startup })).toBeInTheDocument();
    startupView.unmount();

    const sessions = localized(locale, <SidebarSessionList
      sessions={[{
        id: 'session-1', title: 'Alpha', activity: {
          phase: 'waitingOnApproval', isUnread: true,
          statusLabel: 'runtime label', statusDescription: 'runtime description',
        },
      }]}
      currentSessionId={null} onSwitch={vi.fn()}
    />);
    expect(screen.getByTestId('session-activity-session-1')).toHaveAccessibleName(activity);
    expect(screen.getByTestId('session-item')).toHaveAccessibleName(
      locale === 'zh' ? 'Alpha. Agent 正在等待工具批准' : 'Alpha. Agent is waiting for tool approval',
    );
    sessions.unmount();

    const menu = localized(locale, <SessionManagementMenu
      title="Alpha"
      model={{
        sessionId: 'session-1', isPinned: false, isArchived: false, isRunning: false,
        commands: ['rename', 'pin'] as const,
      }}
      actions={{ rename: vi.fn(), setPinned: vi.fn() }}
    />);
    fireEvent.click(screen.getByRole('button', { name: manage }));
    expect(screen.getByRole('menuitem', {
      name: locale === 'zh' ? '重命名' : 'Rename',
    })).toBeInTheDocument();
    menu.unmount();
  });

  it('renders approval and request-input decisions without changing payload data', () => {
    const approvalView = localized(locale, <ToolApprovalModal
      request={approval} onDecision={vi.fn()}
    />);
    expect(screen.getByRole('alertdialog', {
      name: locale === 'zh' ? '批准此工具？' : 'Approve this tool?',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: locale === 'zh' ? '仅允许一次' : 'Allow once',
    })).toBeInTheDocument();
    expect(screen.getByText('pwd')).toBeInTheDocument();
    approvalView.unmount();

    const inputView = localized(locale, <UserInputForm request={question} onSubmit={vi.fn()} />);
    expect(screen.getByRole('dialog', {
      name: locale === 'zh' ? '需要输入' : 'Input required',
    })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Yes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: locale === 'zh' ? '提交回答' : 'Submit answers',
    })).toBeInTheDocument();
    inputView.unmount();
  });
});
