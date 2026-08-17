import type {
  ChatPanelMessage,
  TimelineStatusView,
  TimelineTurnView,
} from '@svton/agent-ui';

export const TRANSCRIPT_FIXTURE_EVENT = 'svton:e2e-transcript-state';
export const SYNTHETIC_FAILURE_MARKER = 'SYNTHETIC_FAILURE_DETAIL_I083A';
export const SYNTHETIC_COMMAND_MARKER = 'SYNTHETIC_COMMAND_I083A';
export const SYNTHETIC_TOOL_MARKER = 'synthetic_fixture_runner';
export const SYNTHETIC_ANSWER_MARKER = 'SYNTHETIC_ANSWER_I083A';

export type TranscriptFixtureStateId =
  | 'restore-history'
  | 'start-completed' | 'settle-completed'
  | 'start-failed' | 'settle-failed'
  | 'start-interrupted' | 'settle-interrupted'
  | 'start-cancelled' | 'settle-cancelled'
  | 'token-delta' | 'progress-revision'
  | 'session-switch' | 'theme-dark' | 'theme-light';

export interface TranscriptFixtureModel {
  stateId: TranscriptFixtureStateId;
  messages: ChatPanelMessage[];
  streaming: boolean;
  runIndex: number;
}

const STATE_IDS = new Set<TranscriptFixtureStateId>([
  'restore-history',
  'start-completed', 'settle-completed',
  'start-failed', 'settle-failed',
  'start-interrupted', 'settle-interrupted',
  'start-cancelled', 'settle-cancelled',
  'token-delta', 'progress-revision',
  'session-switch', 'theme-dark', 'theme-light',
]);

const historyMessages = (imageUrl: string): ChatPanelMessage[] => [
  {
    id: 'fixture-user-history', role: 'user',
    content: `Review the deterministic transcript. ${SYNTHETIC_ANSWER_MARKER}`,
  },
  {
    id: 'fixture-assistant-history', role: 'assistant', content: '',
    timeline: {
      version: 1, sessionId: 'fixture-session-current', turnId: 'fixture-turn-history',
      status: 'completed', items: [], revision: 1,
    },
    blocks: [
      {
        type: 'image_generated', model: 'fixture-image-model',
        images: [{ url: imageUrl, revisedPrompt: 'Synthetic image prompt' }],
      },
      {
        type: 'text',
        text: `Historical response with long wrapping content ${'readable transcript content '.repeat(24)}\n\n\`\`\`ts\nconst keyboardReachable = true;\n\`\`\``,
      },
    ],
  },
];

export function initialTranscriptFixture(imageUrl: string): TranscriptFixtureModel {
  return { stateId: 'restore-history', messages: historyMessages(imageUrl), streaming: false, runIndex: 0 };
}

export function isTranscriptFixtureStateId(value: unknown): value is TranscriptFixtureStateId {
  return typeof value === 'string' && STATE_IDS.has(value as TranscriptFixtureStateId);
}

export function applyTranscriptFixtureState(
  current: TranscriptFixtureModel,
  stateId: TranscriptFixtureStateId,
  imageUrl: string,
): TranscriptFixtureModel {
  if (stateId === 'restore-history') return initialTranscriptFixture(imageUrl);
  if (stateId === 'session-switch') return switchedSession(current);
  if (stateId === 'theme-dark' || stateId === 'theme-light') return { ...current, stateId };
  if (stateId.startsWith('start-')) return startRun(current, stateId);
  if (stateId.startsWith('settle-')) return settleRun(current, stateId);
  if (stateId === 'token-delta') return updateCurrent(current, stateId, (message) => ({
    ...message, content: `${message.content} token-delta`,
  }));
  return updateCurrent(current, stateId, (message) => ({
    ...message,
    timeline: message.timeline ? {
      ...message.timeline,
      revision: message.timeline.revision + 1,
      items: message.timeline.items.map((item) => item.kind === 'commandExecution'
        ? { ...item, revision: item.revision + 1, progress: [...item.progress, {
          id: `progress-${item.revision + 1}`, text: `Visible progress revision ${item.revision + 1}`, createdAt: item.revision + 2,
        }] } : item),
    } : undefined,
  }));
}

function startRun(current: TranscriptFixtureModel, stateId: TranscriptFixtureStateId): TranscriptFixtureModel {
  const runIndex = current.runIndex + 1;
  const message = runMessage(runIndex, 'running');
  return {
    stateId, runIndex, streaming: true,
    messages: [...current.messages, message],
  };
}

function settleRun(current: TranscriptFixtureModel, stateId: TranscriptFixtureStateId): TranscriptFixtureModel {
  const status = stateId.replace('settle-', '') as Exclude<TimelineStatusView, 'pending' | 'awaitingApproval' | 'declined' | 'running'>;
  return updateCurrent(current, stateId, () => runMessage(current.runIndex, status), false);
}

function updateCurrent(
  current: TranscriptFixtureModel,
  stateId: TranscriptFixtureStateId,
  update: (message: ChatPanelMessage) => ChatPanelMessage,
  streaming = current.streaming,
): TranscriptFixtureModel {
  const id = `fixture-run-${current.runIndex}`;
  return { ...current, stateId, streaming, messages: current.messages.map((message) => message.id === id ? update(message) : message) };
}

function runMessage(runIndex: number, status: TimelineStatusView): ChatPanelMessage {
  const failed = status === 'failed';
  return {
    id: `fixture-run-${runIndex}`, role: 'assistant',
    isStreaming: status === 'running',
    content: `Synthetic run ${runIndex} response body with ${'long result content '.repeat(20)}`,
    timeline: timeline(runIndex, status),
    blocks: failed ? [{ type: 'error', text: SYNTHETIC_FAILURE_MARKER }] : undefined,
  };
}

function timeline(runIndex: number, status: TimelineStatusView): TimelineTurnView {
  const terminal = status !== 'running';
  return {
    version: 1, sessionId: 'fixture-session-current', turnId: `fixture-turn-${runIndex}`,
    status: status === 'cancelled' ? 'running' : status as TimelineTurnView['status'],
    revision: terminal ? 2 : 1,
    items: [{
      id: `fixture-command-${runIndex}`, sessionId: 'fixture-session-current', turnId: `fixture-turn-${runIndex}`,
      kind: 'commandExecution', lane: terminal ? 'outcome' : 'process', status,
      title: terminal ? `Synthetic ${status} result` : 'Synthetic command running',
      toolName: SYNTHETIC_TOOL_MARKER, command: `${SYNTHETIC_COMMAND_MARKER} --safe-fixture`,
      progress: [{ id: 'progress-1', text: 'Visible initial progress', createdAt: 1 }],
      stdout: terminal && !failedStatus(status) ? 'Long stdout '.repeat(80) : undefined,
      stderr: failedStatus(status) ? SYNTHETIC_FAILURE_MARKER : undefined,
      exitCode: failedStatus(status) ? 7 : terminal ? 0 : undefined,
      durationMs: terminal ? 2345 : undefined,
      revision: terminal ? 2 : 1,
    }],
  };
}

function failedStatus(status: TimelineStatusView): boolean {
  return status === 'failed';
}

function switchedSession(current: TranscriptFixtureModel): TranscriptFixtureModel {
  const archived = runMessage(999, 'completed');
  archived.id = 'fixture-archived-run';
  archived.timeline = archived.timeline ? { ...archived.timeline, sessionId: 'fixture-session-archived', turnId: 'fixture-turn-archived' } : undefined;
  return { ...current, stateId: 'session-switch', messages: [archived], streaming: false };
}
