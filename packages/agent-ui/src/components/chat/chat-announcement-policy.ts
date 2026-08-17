import type { ChatPanelMessage } from './chat-panel.types';
import type { TimelineStatusView, TimelineTurnView } from '../timeline/timeline.types';
import type { TranslationKey } from '@svton/ui/i18n';

export type ChatAnnouncementSink = 'dialog' | 'polite' | 'assertive' | 'none';
export type ChatRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled';
type TerminalRunStatus = Exclude<ChatRunStatus, 'idle' | 'running'>;

export interface DecisionAnnouncement {
  kind: 'approval' | 'requestInput';
  key: string;
}

export interface ChatAnnouncementSnapshot {
  scopeKey: string;
  runKey: string | null;
  status: ChatRunStatus;
  messageIds: string[];
  updateKey: string;
  decision: DecisionAnnouncement | null;
}

export interface ChatAnnouncementEvent {
  key: string;
  sink: ChatAnnouncementSink;
  messageKey?: TranslationKey;
}

export const SILENT_CHAT_ANNOUNCEMENT: ChatAnnouncementEvent = {
  key: 'none', sink: 'none',
};

/** Builds transition identity without retaining transcript content or error payloads. */
export function createChatAnnouncementSnapshot(
  messages: ChatPanelMessage[],
  isStreaming: boolean,
  decision: DecisionAnnouncement | null,
): ChatAnnouncementSnapshot {
  const timelineMessage = latestTimelineMessage(messages);
  const timeline = timelineMessage?.timeline;
  const messageIds = messages.map((message) => message.id);
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const updateMessage = timelineMessage ?? messages.at(-1);
  return {
    scopeKey: timeline?.sessionId ?? `legacy:${messageIds.at(0) ?? 'empty'}`,
    runKey: timeline ? `${timeline.sessionId}:${timeline.turnId}`
      : latestUser?.id ?? latestAssistant?.id ?? messages.at(-1)?.id ?? null,
    status: resolveRunStatus(messages, timeline, isStreaming),
    messageIds,
    updateKey: updateMessage ? messageUpdateKey(updateMessage) : 'empty',
    decision,
  };
}

function messageUpdateKey(message: ChatPanelMessage): string {
  const timeline = message.timeline;
  const items = timeline?.items.map((item) => (
    `${item.id}:${item.status}:${item.revision}:${'progress' in item ? item.progress.length : 0}`
  )).join(',') ?? '';
  const blocks = message.blocks?.map((block) => [
    block.type, block.status ?? '', block.call?.id ?? '', block.call?.status ?? '',
    fingerprint(block.text ?? ''), fingerprint(block.summary ?? ''),
  ].join(':')).join(',') ?? '';
  return [message.id, fingerprint(message.content), fingerprint(message.thinking ?? ''),
    message.isStreaming ? 1 : 0, timeline?.revision ?? 0, items, blocks].join(':');
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Returns exactly one semantic sink for a real current-session transition. */
export function selectChatAnnouncement(
  previous: ChatAnnouncementSnapshot,
  current: ChatAnnouncementSnapshot,
): ChatAnnouncementEvent {
  if (current.decision && current.decision.key !== previous.decision?.key) {
    return { key: current.decision.key, sink: 'dialog' };
  }
  const continues = transcriptContinues(previous.messageIds, current.messageIds);
  const sameScope = previous.messageIds.length === 0 || previous.scopeKey === current.scopeKey;
  if (current.status === 'running' && previous.status !== 'running' && continues && sameScope) {
    return transitionEvent(current, 'polite', 'chat.announcement.started');
  }
  if (previous.status === 'running' && current.status !== 'running'
    && isTerminalRunStatus(current.status)
    && previous.runKey === current.runKey && current.runKey) {
    return terminalEvent(current, current.status);
  }
  return SILENT_CHAT_ANNOUNCEMENT;
}

function latestTimelineMessage(messages: ChatPanelMessage[]): ChatPanelMessage | undefined {
  return [...messages].reverse().find((message) => message.timeline);
}

function resolveRunStatus(
  messages: ChatPanelMessage[],
  timeline: TimelineTurnView | undefined,
  isStreaming: boolean,
): ChatRunStatus {
  if (isStreaming) return 'running';
  if (timeline) {
    const status = timeline.status as TimelineStatusView;
    switch (status) {
      case 'completed':
      case 'failed':
      case 'interrupted':
      case 'cancelled':
        return status;
      case 'running':
        return timeline.items.some((item) => item.status === 'cancelled') ? 'cancelled' : 'idle';
      case 'pending':
      case 'awaitingApproval':
      case 'declined':
        return 'idle';
      default:
        return 'idle';
    }
  }
  if (messages.length === 0) return 'idle';
  return messages.some(hasVisibleFailure) ? 'failed' : 'completed';
}

function hasVisibleFailure(message: ChatPanelMessage): boolean {
  return Boolean(message.error || message.blocks?.some((block) => block.type === 'error'));
}

function transcriptContinues(previous: string[], current: string[]): boolean {
  return previous.length === 0 || previous.every((id) => current.includes(id));
}

function terminalEvent(snapshot: ChatAnnouncementSnapshot, status: TerminalRunStatus): ChatAnnouncementEvent {
  const view: Record<TerminalRunStatus, TranslationKey> = {
    completed: 'chat.announcement.completed',
    failed: 'chat.announcement.failed',
    interrupted: 'chat.announcement.interrupted',
    cancelled: 'chat.announcement.cancelled',
  };
  const sink = status === 'completed' ? 'polite' : 'assertive';
  return transitionEvent(snapshot, sink, view[status]);
}

function transitionEvent(
  snapshot: ChatAnnouncementSnapshot,
  sink: Exclude<ChatAnnouncementSink, 'dialog' | 'none'>,
  messageKey: TranslationKey,
): ChatAnnouncementEvent {
  return { key: `${snapshot.runKey}:${snapshot.status}`, sink, messageKey };
}

function isTerminalRunStatus(status: ChatRunStatus): status is TerminalRunStatus {
  return status === 'completed' || status === 'failed'
    || status === 'interrupted' || status === 'cancelled';
}

export function isTerminalTimelineStatus(status: TimelineStatusView): boolean {
  return ['completed', 'failed', 'declined', 'cancelled', 'interrupted'].includes(status);
}
