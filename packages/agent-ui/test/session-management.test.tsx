import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionManagementMenu } from '../src/components/layout/SessionManagementMenu';
import { SessionSearchControls } from '../src/components/layout/SessionSearchControls';
import { SidebarSessionList } from '../src/components/layout/SidebarSessionList';
import type { SessionManagementActions } from '../src/components/layout/sidebar.types';
import { LocaleProvider } from '@svton/ui';

const renderZh = (child: React.ReactNode) => render(
  <LocaleProvider locale="zh">{child}</LocaleProvider>,
);

describe('session management accessibility', () => {
  it('uses pressed filter buttons and keeps content extension explicit and opt-in', async () => {
    const user = userEvent.setup();
    const setScope = vi.fn();
    const setIncludeContent = vi.fn();
    renderZh(<SessionSearchControls search={{
      query: '', scope: 'active', includeContent: false, searching: false, error: null,
      setQuery: vi.fn(), setScope, setIncludeContent, retry: vi.fn(),
    }} />);
    const group = screen.getByRole('group', { name: '对话范围筛选' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对话' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '已归档' }));
    expect(setScope).toHaveBeenCalledWith('archived');
    expect(screen.getByRole('checkbox', { name: '搜索消息内容（svton 扩展）' }))
      .not.toBeChecked();
    await user.click(screen.getByRole('checkbox'));
    expect(setIncludeContent).toHaveBeenCalledWith(true);
  });

  it('navigates the menu with arrows and restores trigger focus on Escape', async () => {
    const user = userEvent.setup();
    renderZh(<SessionManagementMenu title="Alpha" model={model()} actions={actions()} />);
    const trigger = screen.getByRole('button', { name: '管理 Alpha' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: '重命名' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: '置顶' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    screen.getByRole('menuitem', { name: '重命名' }).blur();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(screen.getByRole('menuitem', { name: '永久删除' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    expect(screen.getByLabelText('对话标题')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps dialog focus and prevents duplicate permanent deletion', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const remove = vi.fn(() => pending);
    renderZh(<SessionManagementMenu title="Alpha" model={model()} actions={{
      ...actions(), deletePermanently: remove,
    }} />);
    await user.click(screen.getByRole('button', { name: '管理 Alpha' }));
    await user.click(screen.getByRole('menuitem', { name: '永久删除' }));
    const cancel = screen.getByRole('button', { name: '取消' });
    const confirm = screen.getByRole('button', { name: '永久删除' });
    expect(cancel).toHaveFocus();
    confirm.focus();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Tab' });
    expect(cancel).toHaveFocus();
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(remove).toHaveBeenCalledOnce();
    release();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('shows visible async errors and blocks archived row navigation', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    renderZh(<SidebarSessionList
      sessions={[{
        id: 'a', title: 'Archived', management: {
          ...model(), isArchived: true, commands: ['rename', 'unarchive', 'delete'],
        },
      }]}
      currentSessionId={null}
      onSwitch={onSwitch}
      managementActions={{ ...actions(), unarchive: vi.fn().mockRejectedValue(new Error('fail')) }}
    />);
    expect(screen.getByText('取消归档后打开')).toBeVisible();
    expect(screen.getByTestId('session-item')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '管理 Archived' }));
    await user.click(screen.getByRole('menuitem', { name: '取消归档' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('操作未完成，请重试。');
    expect(onSwitch).not.toHaveBeenCalled();
  });
});

function model() {
  return {
    sessionId: 'a', isPinned: false, isArchived: false, isRunning: false,
    commands: ['rename', 'pin', 'archive', 'delete'] as const,
  };
}

function actions(): SessionManagementActions {
  const ok = async () => ({ ok: true });
  return {
    rename: ok, setPinned: ok, archive: ok, stopAndArchive: ok,
    unarchive: ok, deletePermanently: async () => {},
  };
}
