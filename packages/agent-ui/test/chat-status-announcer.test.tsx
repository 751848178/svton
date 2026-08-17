import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatStatusAnnouncer } from '../src/components/chat/ChatStatusAnnouncer';
import type { ChatPanelMessage } from '../src/components/chat/chat-panel.types';
import type { TimelineTurnView } from '../src/components/timeline/timeline.types';

const assistant = (
  status: TimelineTurnView['status'],
  overrides: Partial<ChatPanelMessage> = {},
  sessionId = 'session-a',
): ChatPanelMessage => ({
  id: 'assistant-1', role: 'assistant', content: 'Working',
  timeline: turn(status, sessionId), ...overrides,
});

const renderAnnouncer = (messages: ChatPanelMessage[], isStreaming = false) => render(
  <ChatStatusAnnouncer messages={messages} isStreaming={isStreaming} decision={null} />,
);

describe('ChatStatusAnnouncer', () => {
  it('keeps restored history silent and exposes no active live sink', () => {
    renderAnnouncer([assistant('failed', { error: 'old-secret-error' })]);
    const owner = screen.getByTestId('chat-status-announcer');
    expect(owner).toHaveAttribute('aria-live', 'off');
    expect(owner).toBeEmptyDOMElement();
  });

  it.each([
    ['appended token delta', 'Working token'],
    ['same-length token replacement', 'Changed'],
  ])('announces run start once and clears for a silent %s', (_label, content) => {
    const view = renderAnnouncer([]);
    view.rerender(<ChatStatusAnnouncer messages={[assistant('running')]} isStreaming decision={null} />);
    const owner = screen.getByTestId('chat-status-announcer');
    expect(owner).toHaveTextContent('Run started.');
    expect(owner).toHaveAttribute('data-announcement-event-key', 'session-a:turn-1:running');
    view.rerender(<ChatStatusAnnouncer messages={[assistant('running', {
      content,
    })]} isStreaming decision={null} />);
    expect(owner).toHaveAttribute('data-announcement-sink', 'none');
    expect(owner).toHaveAttribute('aria-live', 'off');
    expect(owner).toBeEmptyDOMElement();
  });

  it('clears the run-start sink for a silent progress revision', () => {
    const view = renderAnnouncer([]);
    view.rerender(<ChatStatusAnnouncer messages={[assistant('running')]} isStreaming decision={null} />);
    const owner = screen.getByTestId('chat-status-announcer');
    expect(owner).toHaveTextContent('Run started.');
    view.rerender(<ChatStatusAnnouncer messages={[assistant('running', {
      timeline: turn('running', 'session-a', 22),
    })]} isStreaming decision={null} />);
    expect(owner).toHaveAttribute('data-announcement-sink', 'none');
    expect(owner).toHaveAttribute('aria-live', 'off');
    expect(owner).toBeEmptyDOMElement();
  });

  it.each([
    ['completed', 'polite', 'Run completed.'],
    ['failed', 'assertive', 'Run failed. Review the visible error details.'],
    ['interrupted', 'assertive', 'Run interrupted.'],
  ] as const)('announces %s once through the expected sink', (status, sink, text) => {
    const view = renderAnnouncer([assistant('running')], true);
    view.rerender(<ChatStatusAnnouncer messages={[assistant(status, {
      error: status === 'failed' ? 'raw secret command token' : undefined,
    })]} isStreaming={false} decision={null} />);
    const owner = screen.getByTestId('chat-status-announcer');
    expect(owner).toHaveAttribute('aria-live', sink);
    expect(owner).toHaveTextContent(text);
    expect(owner).not.toHaveTextContent('raw secret command token');
    view.rerender(<ChatStatusAnnouncer messages={[assistant(status)]} isStreaming={false} decision={null} />);
    expect(owner).toHaveAttribute('data-announcement-event-key', `session-a:turn-1:${status}`);
    expect(owner).toHaveTextContent(text);
  });

  it('announces a cancelled terminal item once with a stable key', () => {
    const view = renderAnnouncer([assistant('running')], true);
    const cancelled = turn('running');
    cancelled.items = [{
      id: 'tool-1', sessionId: 'session-a', turnId: 'turn-1', lane: 'outcome',
      kind: 'toolExecution', toolName: 'danger', arguments: {}, progress: [],
      status: 'cancelled', title: 'Cancelled', revision: 2,
    }];
    view.rerender(<ChatStatusAnnouncer messages={[assistant('running', { timeline: cancelled })]} isStreaming={false} decision={null} />);
    expect(screen.getByTestId('chat-status-announcer')).toHaveTextContent('Run cancelled.');
    expect(screen.getByTestId('chat-status-announcer')).toHaveAttribute(
      'data-announcement-event-key', 'session-a:turn-1:cancelled',
    );
  });

  it('does not announce stale terminal state when switching sessions', () => {
    const view = renderAnnouncer([assistant('running')], true);
    view.rerender(<ChatStatusAnnouncer messages={[assistant('failed', {
      id: 'assistant-other', error: 'other session raw error',
    }, 'session-b')]} isStreaming={false} decision={null} />);
    expect(screen.getByTestId('chat-status-announcer')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByTestId('chat-status-announcer')).toBeEmptyDOMElement();
  });

  it('routes a new decision to dialog ownership without top live text', () => {
    const view = renderAnnouncer([assistant('running')], true);
    view.rerender(<ChatStatusAnnouncer
      messages={[assistant('running')]}
      isStreaming
      decision={{ kind: 'approval', key: 'approval:session-a:approval-1' }}
    />);
    const owner = screen.getByTestId('chat-status-announcer');
    expect(owner).toHaveAttribute('data-announcement-sink', 'dialog');
    expect(owner).toHaveAttribute('aria-live', 'off');
    expect(owner).toBeEmptyDOMElement();
  });
});

function turn(
  status: TimelineTurnView['status'],
  sessionId = 'session-a',
  revision = 1,
): TimelineTurnView {
  return {
    version: 1, sessionId, turnId: 'turn-1', status,
    items: [], revision,
  };
}
