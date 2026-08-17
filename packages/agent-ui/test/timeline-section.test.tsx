import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../src/components/chat/ChatMessage';
import { TimelineSection } from '../src/components/timeline/TimelineSection';
import type { TimelineTurnView } from '../src/components/timeline/timeline.types';

const unavailable = { openTerminal: false } as const;

describe('TimelineSection', () => {
  it('renders no empty process UI for a usage-only turn', () => {
    const timeline = {
      ...turn([], 'completed'),
      usage: { input: 4, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 6 },
    } as TimelineTurnView;
    const { container } = render(
      <TimelineSection timeline={timeline} capabilities={unavailable} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes one accessible process disclosure without a duplicate live owner', () => {
    render(<TimelineSection timeline={turn([{
      ...base('c1'), kind: 'toolExecution', toolName: 'search', arguments: {},
      progress: [{ id: 'p1', text: 'actual update text', createdAt: 2 }],
    }])} capabilities={unavailable} />);
    const disclosure = screen.getByRole('button', { name: /(Process|过程) actual update text/ });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls');
    expect(screen.getByTestId('timeline-progress-update')).not.toHaveAttribute('aria-live');
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('actual update text')).toHaveLength(2);
  });

  it('keeps failed stderr and exit visible and dispatches copy/retry intents', () => {
    const onIntent = vi.fn().mockReturnValue({ status: 'handled' });
    render(<TimelineSection timeline={turn([{
      ...base('c1'), kind: 'commandExecution', toolName: 'bash', command: 'exit 7',
      status: 'failed', lane: 'outcome', title: 'Command failed', progress: [],
      stderr: 'boom', exitCode: 7, retry: { kind: 'message', messageId: 'm1' },
    }], 'completed')} capabilities={unavailable} onIntent={onIntent} />);
    expect(screen.queryByTestId('timeline-process')).not.toBeInTheDocument();
    expect(screen.getByTestId('command-stderr')).toHaveTextContent('boom');
    expect(screen.getByTestId('timeline-command-c1')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByTestId('command-exit-code')).toHaveTextContent('7');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('command-stderr')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Copy stderr' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onIntent).toHaveBeenNthCalledWith(1, { type: 'copy', target: 'stderr', value: 'boom' });
    expect(onIntent).toHaveBeenNthCalledWith(2, {
      type: 'retry', descriptor: { kind: 'message', messageId: 'm1' },
    });
    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeDisabled();
    expect(screen.getByTitle('Terminal unavailable in this host')).toBeInTheDocument();
  });

  it('renders migrated command only once and leaves failure outside legacy process', () => {
    const call = {
      id: 'c1', name: 'bash', arguments: { command: 'exit 7' }, status: 'error' as const,
      result: { callId: 'c1', output: 'boom', isError: true },
    };
    const timeline = turn([{
      ...base('c1'), kind: 'commandExecution', toolName: 'bash', command: 'exit 7',
      status: 'failed', lane: 'outcome', title: 'Command failed', progress: [], stderr: 'boom', exitCode: 7,
    }], 'completed');
    render(<ChatMessage
      id="m1" role="assistant" content="" timeline={timeline}
      blocks={[{ type: 'tool_call', call }]} toolCalls={[call]}
    />);
    expect(screen.getAllByText('Command Failed')).toHaveLength(1);
    expect(screen.queryByTestId('tool-card-bash')).not.toBeInTheDocument();
  });

  it('keeps warnings always visible', () => {
    render(<TimelineSection timeline={turn([{
      ...base('w1'), kind: 'warning', lane: 'outcome', status: 'completed',
      title: 'Warning', diagnostic: 'quota nearly reached',
    }], 'completed')} capabilities={unavailable} />);
    expect(screen.getByTestId('timeline-warning')).toHaveTextContent('quota nearly reached');
    expect(screen.getByTestId('timeline-warning')).toHaveAttribute('aria-live', 'off');
  });

  it('keeps typed approval requests/history visible and suppresses failed legacy cards', () => {
    const call = {
      id: 'call-1', name: 'deploy', arguments: {}, status: 'error' as const,
      result: { callId: 'call-1', output: 'rejected', isError: true },
    };
    const item = {
      ...base('approval-1'), kind: 'approvalDecision' as const,
      requestId: 'approval-1', itemId: 'call-1', toolName: 'deploy', arguments: {},
      decisions: ['accept', 'decline', 'cancel'] as const,
      lane: 'outcome' as const, status: 'declined' as const,
      title: 'Declined deploy', decision: 'decline' as const,
    };
    render(<ChatMessage
      id="m1" role="assistant" content="" timeline={turn([item], 'completed')}
      blocks={[{ type: 'tool_call', call }]} toolCalls={[call]}
    />);
    expect(screen.getByTestId('approval-decision-history')).toHaveTextContent('Declined');
    expect(screen.getByTestId('approval-decision-history')).toHaveAttribute('aria-live', 'off');
    expect(screen.queryByTestId('tool-card-deploy')).not.toBeInTheDocument();
  });
});

function base(id: string) {
  return {
    id, sessionId: 's1', turnId: 'm1', lane: 'process' as const,
    status: 'running' as const, title: 'Running', startedAt: 1, revision: 0,
  };
}

function turn(
  items: TimelineTurnView['items'],
  status: TimelineTurnView['status'] = 'running',
): TimelineTurnView {
  return { version: 1, sessionId: 's1', turnId: 'm1', status, items, revision: 1 };
}
