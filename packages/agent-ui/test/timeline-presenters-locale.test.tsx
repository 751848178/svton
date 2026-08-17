import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@svton/ui';
import { describe, expect, it, vi } from 'vitest';
import { TimelineSection } from '../src/components/timeline/TimelineSection';
import type {
  ApprovalDecisionItemView,
  TimelineItemView,
  TimelineTurnView,
} from '../src/components/timeline/timeline.types';

const unavailable = { openTerminal: false, openPath: false } as const;

describe('timeline presenter locale boundary', () => {
  it('localizes command chrome and preserves machine payloads and intents', () => {
    const onIntent = vi.fn().mockReturnValue({ status: 'handled' });
    renderLocale('zh', [{
      ...base('command'), kind: 'commandExecution', toolName: 'bash',
      status: 'failed', lane: 'outcome', title: 'STALE TITLE', progress: [],
      command: 'printf 动态', stdout: 'out-动态', stderr: 'err-动态',
      exitCode: 17, signal: 'SIG动态', timedOut: true, durationMs: 1000,
      retry: { kind: 'message', messageId: 'message-exact' },
    }], onIntent);
    const card = screen.getByTestId('timeline-command-command');
    expect(card).toHaveTextContent('命令：失败');
    expect(card).toHaveTextContent('命令printf 动态');
    expect(card).toHaveTextContent('标准输出out-动态');
    expect(card).toHaveTextContent('标准错误err-动态');
    expect(card).toHaveTextContent('退出码：17');
    expect(card).toHaveTextContent('信号：SIG动态');
    expect(card).toHaveTextContent('已超时');
    expect(screen.getByTestId('command-duration')).toHaveTextContent('1.0 秒');
    fireEvent.click(screen.getByRole('button', { name: '复制命令' }));
    fireEvent.click(screen.getByRole('button', { name: '重新生成' }));
    expect(onIntent).toHaveBeenNthCalledWith(1, {
      type: 'copy', target: 'command', value: 'printf 动态',
    });
    expect(onIntent).toHaveBeenNthCalledWith(2, {
      type: 'retry', descriptor: { kind: 'message', messageId: 'message-exact' },
    });
    expect(screen.getByRole('button', { name: '打开终端' })).toBeDisabled();
    expect(screen.getByTitle('当前客户端无法打开终端')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('STALE TITLE');
  });

  it('localizes arbitrary tool chrome and preserves result and explicit host feedback', async () => {
    const onIntent = vi.fn().mockResolvedValue({
      status: 'unavailable', message: '动态 host byte',
    });
    renderLocale('zh', [{
      ...base('tool'), kind: 'toolExecution', toolName: 'list_动态',
      status: 'completed', lane: 'outcome', title: 'STALE TITLE', progress: [],
      result: '[{"name":"/动态/path"}]',
    }], onIntent);
    const card = screen.getByTestId('timeline-tool-tool');
    expect(card).toHaveTextContent('list_动态：已完成');
    expect(card).toHaveTextContent('[{"name":"/动态/path"}]');
    fireEvent.click(screen.getByRole('button', { name: '复制结果' }));
    expect(await screen.findByRole('status')).toHaveTextContent('动态 host byte');
    expect(onIntent).toHaveBeenCalledWith({
      type: 'copy', target: 'result', value: '[{"name":"/动态/path"}]',
    });
  });

  it('projects outcome semantics without translating runtime diagnostics', () => {
    const items: TimelineItemView[] = [{
      ...base('warning'), kind: 'warning', status: 'completed', lane: 'outcome',
      title: 'STALE WARNING', diagnostic: '动态 diagnostic byte',
    }, {
      ...base('error'), kind: 'error', status: 'failed', lane: 'outcome',
      title: 'STALE ERROR', diagnostic: 'Agent run failed', code: 'agent_run_failed',
    }];
    const { rerender } = render(wrapped('en', items));
    expect(screen.getByTestId('timeline-warning')).toHaveTextContent('Warning动态 diagnostic byte');
    expect(screen.getByTestId('timeline-error')).toHaveTextContent('Provider errorAgent run failed');
    rerender(wrapped('zh', items));
    expect(screen.getByTestId('timeline-warning')).toHaveTextContent('警告动态 diagnostic byte');
    expect(screen.getByTestId('timeline-error')).toHaveTextContent('服务提供方错误Agent 运行失败');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('derives process and approval titles while keeping progress and reason exact', () => {
    renderLocale('zh', [{
      ...base('running'), kind: 'toolExecution', toolName: 'search_动态',
      title: 'STALE RUNNING', progress: [{ id: 'p', text: 'raw-progress-动态', createdAt: 2 }],
    }, approval()], undefined, 'running');
    const process = screen.getByTestId('timeline-process');
    expect(process).toHaveTextContent('过程raw-progress-动态');
    fireEvent.click(screen.getByRole('button', { name: /过程\s+raw-progress-动态/ }));
    expect(process).toHaveTextContent('search_动态：执行中');
    const approvalCard = screen.getByTestId('approval-decision-history');
    expect(approvalCard).toHaveTextContent('请求批准 deploy_动态');
    expect(approvalCard).toHaveTextContent('等待批准');
    expect(approvalCard).toHaveTextContent('reason-动态-byte');
  });

  it.each([
    ['accept', 'Allowed once', '已允许一次'],
    ['acceptForSession', 'Allowed for session', '本会话已允许'],
    ['decline', 'Declined', '已拒绝'],
    ['cancel', 'Cancelled', '已取消'],
    ['interrupted', 'Interrupted', '已中断'],
  ] as const)('localizes settled approval %s', (decision, en, zh) => {
    const status = decision === 'accept' || decision === 'acceptForSession'
      ? 'completed'
      : decision === 'decline' ? 'declined' : decision === 'cancel' ? 'cancelled' : 'interrupted';
    const item = approval({ status, decision });
    const { rerender } = render(wrapped('en', [item]));
    expect(screen.getByTestId('approval-decision-history')).toHaveTextContent(en);
    rerender(wrapped('zh', [item]));
    expect(screen.getByTestId('approval-decision-history')).toHaveTextContent(zh);
  });
});

function renderLocale(
  locale: 'en' | 'zh',
  items: TimelineItemView[],
  onIntent?: ReturnType<typeof vi.fn>,
  status: TimelineTurnView['status'] = 'completed',
) {
  return render(wrapped(locale, items, onIntent, status));
}

function wrapped(
  locale: 'en' | 'zh', items: TimelineItemView[],
  onIntent?: ReturnType<typeof vi.fn>, status: TimelineTurnView['status'] = 'completed',
) {
  const timeline: TimelineTurnView = {
    version: 1, sessionId: 'session', turnId: 'turn', status, items, revision: 1,
  };
  return <LocaleProvider locale={locale}><TimelineSection
    timeline={timeline} capabilities={unavailable} onIntent={onIntent}
  /></LocaleProvider>;
}

function base(id: string) {
  return {
    id, sessionId: 'session', turnId: 'turn', lane: 'process' as const,
    status: 'running' as const, title: 'STALE', revision: 0,
  };
}

function approval(overrides: Partial<ApprovalDecisionItemView> = {}): ApprovalDecisionItemView {
  return {
    ...base('approval'), kind: 'approvalDecision', requestId: 'approval', itemId: 'call',
    toolName: 'deploy_动态', arguments: {}, reason: 'reason-动态-byte',
    decisions: ['accept', 'acceptForSession', 'decline', 'cancel'],
    status: 'awaitingApproval', lane: 'decision', ...overrides,
  };
}
