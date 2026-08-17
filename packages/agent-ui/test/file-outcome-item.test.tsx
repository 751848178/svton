import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../src/components/chat/ChatMessage';
import { TimelineSection } from '../src/components/timeline/TimelineSection';
import type {
  FileOutcomeItemView,
  TimelineItemView,
  TimelineTurnView,
} from '../src/components/timeline/timeline.types';

const unavailable = { openTerminal: false, openPath: false } as const;
const desktop = { openTerminal: false, openPath: true } as const;

describe('file outcome item', () => {
  it('keeps summary/path/status visible and exposes one keyboard disclosure', async () => {
    const user = userEvent.setup();
    render(<TimelineSection timeline={turn([fileItem()])} capabilities={unavailable} />);
    expect(screen.getByTestId('timeline-file-outcome')).toHaveTextContent('File change Completed');
    expect(screen.getByTestId('timeline-file-outcome')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByTestId('timeline-file-outcome')).toHaveAttribute(
      'data-timeline-id', 'timeline:file:call:call-1',
    );
    expect(screen.getByTestId('timeline-file-outcome')).toHaveAttribute('data-source-call-ids', 'call-1');
    expect(screen.getByTestId('timeline-file-outcome')).toHaveTextContent('/workspace/src/app.ts');
    expect(screen.getByTestId('timeline-file-outcome')).toHaveTextContent('Completed');
    const disclosure = screen.getByRole('button', { name: 'Show details' });
    expect(screen.getAllByRole('button', { name: /details/i })).toHaveLength(1);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const regionId = disclosure.getAttribute('aria-controls');
    expect(regionId).toBeTruthy();
    expect(document.getElementById(regionId!)).toHaveAttribute('hidden');
    disclosure.focus();
    await user.keyboard('{Enter}');
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(regionId!)).not.toHaveAttribute('hidden');
  });

  it('dispatches item-owned copy diff/path and safe open-path intents without final text', async () => {
    const onIntent = vi.fn().mockResolvedValue({ status: 'handled' });
    render(<ChatMessage
      id="turn-file"
      role="assistant"
      content=""
      timeline={turn([fileItem()])}
      timelineCapabilities={desktop}
      onTimelineIntent={onIntent}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Path' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Diff' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open path' }));
    expect(onIntent).toHaveBeenNthCalledWith(1, {
      type: 'copy', target: 'path', value: '/workspace/src/app.ts',
    });
    expect(onIntent).toHaveBeenNthCalledWith(2, {
      type: 'copy', target: 'diff', value: '@@ -1 +1 @@\n-old\n+new',
    });
    expect(onIntent).toHaveBeenNthCalledWith(3, {
      type: 'open', target: 'path', value: '/workspace/src/app.ts',
    });
  });

  it('announces Web open unavailability and never dispatches a handled-looking open', () => {
    const onIntent = vi.fn();
    render(<TimelineSection
      timeline={turn([fileItem()])}
      capabilities={unavailable}
      onIntent={onIntent}
    />);
    const open = screen.getByRole('button', { name: 'Open path' });
    expect(open).toBeDisabled();
    expect(open).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    expect(open).toHaveAttribute('title', 'Opening paths is unavailable in this host');
    expect(screen.getByRole('status')).toHaveTextContent('Open unavailable in this host');
    fireEvent.click(open);
    expect(onIntent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'open' }));
  });

  it('renders one aggregate and suppresses its source execution and legacy file cards', () => {
    const aggregate = fileItem({
      id: 'timeline:file:turn:turn-file',
      scope: 'turn',
      sourceCallIds: ['call-1', 'call-2'],
      title: '2 file changes completed',
      summary: '2 files affected',
      changes: [
        fileItem().changes[0]!,
        {
          sourceCallId: 'call-2', path: '/workspace/src/app.ts',
          changeType: 'create', status: 'completed', diff: '+new',
        },
      ],
    });
    const executions: TimelineItemView[] = ['call-1', 'call-2'].map((id) => ({
      ...base(id), kind: 'toolExecution', toolName: 'file_edit', arguments: {}, progress: [],
      lane: 'outcome', status: 'completed', title: `${id} completed`,
    }));
    render(<ChatMessage
      id="turn-file"
      role="assistant"
      content=""
      timeline={turn([...executions, aggregate])}
      blocks={[
        { type: 'file_change', changes: aggregate.changes },
        { type: 'turn_diff', changes: aggregate.changes },
      ]}
    />);
    expect(screen.getAllByTestId('timeline-file-outcome')).toHaveLength(1);
    expect(screen.getByTestId('timeline-file-outcome')).toHaveAttribute('data-source-call-ids', 'call-1 call-2');
    expect(screen.getByTestId('timeline-file-outcome')).toHaveTextContent('2 file changes Completed');
    expect(screen.getAllByText('/workspace/src/app.ts')).toHaveLength(2);
    expect(screen.queryByText('call-1 completed')).not.toBeInTheDocument();
    expect(screen.queryByText('call-2 completed')).not.toBeInTheDocument();
  });
});

function fileItem(overrides: Partial<FileOutcomeItemView> = {}): FileOutcomeItemView {
  return {
    ...base('timeline:file:call:call-1'),
    kind: 'fileOutcome', scope: 'file', sourceCallIds: ['call-1'],
    lane: 'outcome', status: 'completed', title: 'File change completed',
    summary: 'modify /workspace/src/app.ts', completedAt: 2,
    changes: [{
      sourceCallId: 'call-1', path: '/workspace/src/app.ts',
      changeType: 'modify', status: 'completed',
      diff: '@@ -1 +1 @@\n-old\n+new',
    }],
    ...overrides,
  };
}

function base(id: string) {
  return {
    id, sessionId: 's-file', turnId: 'turn-file', lane: 'process' as const,
    status: 'running' as const, title: 'Running', startedAt: 1, revision: 0,
  };
}

function turn(items: TimelineItemView[]): TimelineTurnView {
  return {
    version: 1, sessionId: 's-file', turnId: 'turn-file',
    status: 'completed', items, revision: 1,
  };
}
