import type { DisplayMessage } from '../types';
import { interruptMessageTimeline } from '../timeline/message-projection';
import type { SessionRunState } from './chat-run.types';

/** Preserve exact run-owned display evidence while canonical Pi history stays authoritative. */
export function reconcileInterruptedDisplay(
  canonical: DisplayMessage[],
  persisted: DisplayMessage[],
  recovered: SessionRunState,
): DisplayMessage[] {
  const evidence = persisted.filter((message) => message.runId === recovered.runId);
  if (evidence.length === 0) return appendMarker(canonical, recovered);
  const savedUser = evidence.find((message) => message.role === 'user');
  const canonicalUserIndex = savedUser?.runtimeMessageIndex === undefined
    ? -1
    : canonical.findIndex((message) => (
      message.role === 'user'
      && message.runtimeMessageIndex === savedUser.runtimeMessageIndex
    ));
  const merged = canonicalUserIndex >= 0
    ? overlayCheckpointTurn(canonical, evidence, canonicalUserIndex, recovered)
    : appendUncheckpointedEvidence(canonical, evidence, recovered);
  return appendMarker(merged, recovered);
}

function overlayCheckpointTurn(
  canonical: DisplayMessage[],
  evidence: DisplayMessage[],
  userIndex: number,
  recovered: SessionRunState,
): DisplayMessage[] {
  const savedUser = evidence.find((message) => message.role === 'user');
  const savedAssistant = evidence.find((message) => message.role === 'assistant');
  const nextUser = canonical.findIndex((message, index) => (
    index > userIndex && message.role === 'user'
  ));
  const end = nextUser < 0 ? canonical.length : nextUser;
  let assistantIndex = -1;
  for (let index = end - 1; index > userIndex; index -= 1) {
    if (canonical[index].role === 'assistant') {
      assistantIndex = index;
      break;
    }
  }
  return canonical.map((message, index) => {
    if (index === userIndex && savedUser) {
      return { ...message, id: savedUser.id, runId: recovered.runId };
    }
    if (index !== assistantIndex) return message;
    return interruptEvidence({
      ...message,
      ...(savedAssistant ? { id: savedAssistant.id } : {}),
      runId: recovered.runId,
    }, recovered);
  });
}

function appendUncheckpointedEvidence(
  canonical: DisplayMessage[],
  evidence: DisplayMessage[],
  recovered: SessionRunState,
): DisplayMessage[] {
  const knownIds = new Set(canonical.map((message) => message.id));
  const tail = evidence
    .filter((message) => !knownIds.has(message.id))
    .map((message) => message.role === 'assistant'
      ? interruptEvidence(message, recovered)
      : { ...message, isStreaming: false });
  return [...canonical, ...tail];
}

function interruptEvidence(
  message: DisplayMessage,
  recovered: SessionRunState,
): DisplayMessage {
  return interruptMessageTimeline(
    { ...message, isStreaming: false },
    recovered.sessionId ?? 'local',
    recovered.completedAt,
  );
}

function appendMarker(
  messages: DisplayMessage[],
  recovered: SessionRunState,
): DisplayMessage[] {
  const id = `interrupted-${recovered.runId}`;
  if (messages.some((message) => message.id === id)) return messages;
  return [...messages, {
    id,
    role: 'system',
    content: 'Turn interrupted',
    systemType: 'default',
    runId: recovered.runId,
    timestamp: recovered.completedAt ?? Date.now(),
  }];
}
