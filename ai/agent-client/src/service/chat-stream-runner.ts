/**
 * Chat stream runner — orchestrates one assistant turn against the runtime.
 *
 * Extracted from ChatService (PI007) to keep the service a thin composition
 * root. Builds the placeholder assistant message, drives `runtime.run()`,
 * routes each event through the event handler, and finalizes the streaming
 * message on completion/error (routing the finalization to the active or
 * background session as appropriate).
 *
 * State mutation is performed through the MessageStoreHost interface so the
 * observable properties on ChatService stay the single source of truth.
 */

import type { UserMessage } from '@earendil-works/pi-ai';
import type { ChatEventHandler } from './chat-event-handler';
import type { MessageStoreHost } from './chat-message-store';
import type { DisplayMessage } from '../types';
import type { ChatRunOwnershipService } from './chat-run-ownership.service';
import type { ChatRunAddress } from './chat-run.types';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import { appendSessionMessage } from './chat-message-store';
import { finalizeStreamEnd } from './chat-stream-settlement';
export { finalizeStreamEnd } from './chat-stream-settlement';

export interface StreamRunnerDeps {
  runtime: {
    run: (
      content: UserMessage['content'],
      options: { sessionId?: string; runRevision?: number },
    ) => AsyncGenerator<import('@svton/agent-core').PublicRuntimeEvent>;
  };
  handler: ChatEventHandler;
  store: MessageStoreHost;
  ownership: ChatRunOwnershipService;
  runs: ChatRunCoordinatorService;
  onBackgroundStreamEnd: ((sessionId: string) => void) | null;
  onActiveStreamEnd?: (sessionId: string | null) => void;
  persistRunDisplay?: (
    sessionId: string,
    phase: import('./chat-run.types').ChatRunPhase,
    state?: import('./chat-run.types').SessionRunState,
  ) => Promise<void>;
  createDisplayMessage: (role: 'user' | 'assistant' | 'system', content: string) => DisplayMessage;
}

export interface PreparedAssistantTurn {
  address: ChatRunAddress;
  assistantMsg: DisplayMessage;
  lease: import('./chat-run-ownership.service').ChatRunLease;
  startedAt: number;
}

/**
 * Run one assistant turn. Adds a streaming placeholder message, iterates the
 * runtime's event stream, and finalizes the message when the stream settles.
 */
export async function runAssistantTurn(
  deps: StreamRunnerDeps,
  address: ChatRunAddress,
  userContent: string,
  images: Array<{ data: string; mimeType?: string }> | undefined,
): Promise<void> {
  const prepared = prepareAssistantTurn(deps, address);
  if (!prepared) return;
  await drivePreparedAssistantTurn(deps, prepared, userContent, images);
}

export function prepareAssistantTurn(
  deps: StreamRunnerDeps,
  address: ChatRunAddress,
  beforeAssistant?: () => void,
): PreparedAssistantTurn | null {
  const assistantMsg = deps.createDisplayMessage('assistant', '');
  assistantMsg.runId = address.runId;
  const lease = deps.ownership.begin(address, assistantMsg.id);
  if (!lease) return null;
  assistantMsg.isStreaming = true;
  const startedAt = Date.now();
  beforeAssistant?.();
  appendSessionMessage(deps.store, address.sessionId, assistantMsg);
  deps.runs.start(address, startedAt);
  deps.handler.resetSequenceState(address);
  return { address, assistantMsg, lease, startedAt };
}

export async function drivePreparedAssistantTurn(
  deps: StreamRunnerDeps,
  prepared: PreparedAssistantTurn,
  userContent: string,
  images: Array<{ data: string; mimeType?: string }> | undefined,
): Promise<void> {
  const { runtime, handler, store, ownership, runs, onBackgroundStreamEnd, onActiveStreamEnd } = deps;
  const { address, assistantMsg, lease, startedAt } = prepared;
  if (!lease.acceptsEvents()) {
    handler.resetSequenceState(address);
    lease.release();
    return;
  }

  const content: UserMessage['content'] = images && images.length > 0
    ? [
        ...(userContent ? [{ type: 'text' as const, text: userContent }] : []),
        ...images.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType ?? 'image/png' })),
      ]
    : userContent;

  let failure: string | undefined;
  try {
    await runs.flush(address.sessionId);
    if (address.sessionId) await deps.persistRunDisplay?.(address.sessionId, 'inProgress');
    const runRevision = runs.state(address.sessionId)?.turnRevision;
    const stream = runtime.run(content, {
      sessionId: address.sessionId ?? undefined,
      runRevision,
    });
    for await (const event of stream) {
      if (!lease.acceptsEvents()) continue;
      handler.handle(event, assistantMsg.id, store, address);
      if (event.type === 'message_end' && address.sessionId) {
        await deps.persistRunDisplay?.(address.sessionId, 'inProgress');
      }
      if (event.type === 'message_end'
        && event.message.role === 'assistant'
        && event.message.stopReason === 'error') {
        failure ??= event.message.errorMessage ?? 'Agent run failed';
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    if (lease.acceptsEvents()) handler.handleProviderFailure(failure, assistantMsg.id, store, address);
  }

  const shouldFinalize = lease.acceptsEvents() && runs.acceptsEvents(address);
  if (shouldFinalize) {
    runs.finalizing(address);
    await runs.flush(address.sessionId);
    if (address.sessionId) await deps.persistRunDisplay?.(address.sessionId, 'finalizing');
    const duration = Date.now() - startedAt;
    const updates = failure
      ? { error: failure, isStreaming: false, duration }
      : { isStreaming: false, duration };
    const publishDisplay = () => finalizeStreamEnd(
      store, address, assistantMsg.id, updates, onBackgroundStreamEnd,
      ownership.assistantMessageId(address.sessionId), onActiveStreamEnd,
    );
    const terminalState = failure
      ? runs.settle({ type: 'failed', ...address, at: Date.now(), error: { message: failure } }, publishDisplay)
      : runs.settle({ type: 'completed', ...address, at: Date.now() }, publishDisplay);
    await runs.flush(address.sessionId);
    if (address.sessionId) {
      await deps.persistRunDisplay?.(
        address.sessionId,
        failure ? 'failed' : 'completed',
        terminalState ?? undefined,
      );
    }
  }
  handler.resetSequenceState(address);
  lease.release();
}

export async function failPreparedAssistantTurn(
  deps: StreamRunnerDeps,
  prepared: PreparedAssistantTurn,
  error: unknown,
): Promise<void> {
  const { address, assistantMsg, lease } = prepared;
  if (!lease.acceptsEvents()) {
    deps.handler.resetSequenceState(address);
    lease.release();
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  deps.handler.handleProviderFailure(message, assistantMsg.id, deps.store, address);
  deps.runs.finalizing(address);
  await deps.runs.flush(address.sessionId);
  if (address.sessionId) await deps.persistRunDisplay?.(address.sessionId, 'finalizing');
  const terminalState = deps.runs.settle({
    type: 'failed', ...address, at: Date.now(), error: { message },
  }, () => finalizeStreamEnd(
      deps.store,
      address,
      assistantMsg.id,
      { error: message, isStreaming: false, duration: Date.now() - prepared.startedAt },
      deps.onBackgroundStreamEnd,
      deps.ownership.assistantMessageId(address.sessionId),
      deps.onActiveStreamEnd,
    ));
  await deps.runs.flush(address.sessionId);
  if (address.sessionId) {
    await deps.persistRunDisplay?.(address.sessionId, 'failed', terminalState ?? undefined);
  }
  deps.handler.resetSequenceState(address);
  lease.release();
}
