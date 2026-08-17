import { describe, expect, it } from 'vitest';
import {
  createChatAnnouncementSnapshot,
  selectChatAnnouncement,
  SILENT_CHAT_ANNOUNCEMENT,
  type DecisionAnnouncement,
} from '../src/components/chat/chat-announcement-policy';
import type { ChatPanelMessage } from '../src/components/chat/chat-panel.types';
import type { TimelineStatusView, TimelineTurnView } from '../src/components/timeline/timeline.types';

const user = (id: string, content = 'Prompt'): ChatPanelMessage => ({ id, role: 'user', content });
const assistant = (
  id: string,
  content: string,
  timeline?: TimelineTurnView,
): ChatPanelMessage => ({ id, role: 'assistant', content, timeline });

describe('chat announcement policy boundaries', () => {
  it('keeps awaiting approval dialog-owned and silent without a decision', () => {
    const running = snapshot([assistant('assistant-1', 'Working', turn('running'))], true);
    const waiting = snapshot([assistant('assistant-1', 'Working', turn('awaitingApproval'))]);
    expect(waiting.status).toBe('idle');
    expect(selectChatAnnouncement(running, waiting)).toEqual(SILENT_CHAT_ANNOUNCEMENT);

    const decision: DecisionAnnouncement = { kind: 'approval', key: 'approval:session-a:1' };
    const dialogOwned = snapshot(
      [assistant('assistant-1', 'Working', turn('awaitingApproval'))],
      false,
      decision,
    );
    expect(selectChatAnnouncement(running, dialogOwned)).toEqual({
      key: decision.key,
      sink: 'dialog',
    });
  });

  it('keeps declined timeline settlement out of top-level terminal announcements', () => {
    const running = snapshot([assistant('assistant-1', 'Working', turn('running'))], true);
    const declined = snapshot([assistant('assistant-1', 'Declined', turn('declined'))]);
    expect(declined.status).toBe('idle');
    expect(selectChatAnnouncement(running, declined)).toEqual(SILENT_CHAT_ANNOUNCEMENT);
  });

  it('keeps a legacy run key stable from start-only user through one-shot completion', () => {
    const empty = snapshot([]);
    const started = snapshot([user('user-turn-1')], true);
    expect(started.runKey).toBe('user-turn-1');
    expect(selectChatAnnouncement(empty, started)).toMatchObject({
      sink: 'polite', messageKey: 'chat.announcement.started',
    });

    const completed = snapshot([
      user('user-turn-1'),
      assistant('assistant-turn-1', 'One-shot answer'),
    ]);
    expect(completed.runKey).toBe('user-turn-1');
    expect(selectChatAnnouncement(started, completed)).toMatchObject({
      key: 'user-turn-1:completed',
      sink: 'polite',
      messageKey: 'chat.announcement.completed',
    });
  });

  it('fingerprints only the current run message while retaining current delta identity', () => {
    const messages = [
      user('old-user'), assistant('old-assistant', 'old history'),
      user('current-user'), assistant('current-assistant', 'token-a'),
    ];
    const initial = snapshot(messages);
    const oldHistoryChanged = snapshot([
      user('old-user'), assistant('old-assistant', 'changed old history'),
      user('current-user'), assistant('current-assistant', 'token-a'),
    ]);
    const currentSameLengthChanged = snapshot([
      ...messages.slice(0, 3), assistant('current-assistant', 'token-b'),
    ]);
    expect(oldHistoryChanged.updateKey).toBe(initial.updateKey);
    expect(currentSameLengthChanged.updateKey).not.toBe(initial.updateKey);
    expect(initial.updateKey).not.toContain('token-a');
  });

  it('changes the current update key for a timeline progress revision', () => {
    const initial = snapshot([assistant('assistant-1', 'Working', turn('running', 1))]);
    const revised = snapshot([assistant('assistant-1', 'Working', turn('running', 2))]);
    expect(revised.updateKey).not.toBe(initial.updateKey);
  });
});

function snapshot(
  messages: ChatPanelMessage[],
  streaming = false,
  decision: DecisionAnnouncement | null = null,
) {
  return createChatAnnouncementSnapshot(messages, streaming, decision);
}

function turn(status: TimelineStatusView, revision = 1): TimelineTurnView {
  return {
    version: 1,
    sessionId: 'session-a',
    turnId: 'turn-1',
    status: status as TimelineTurnView['status'],
    items: [],
    revision,
  };
}
