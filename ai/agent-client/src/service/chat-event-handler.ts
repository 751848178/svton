/**
 * Chat event handler — projects native Pi and Svton capability events into the
 * product display store.
 *
 * Stateless dispatcher: each `handle()` call receives the live message-store
 * host (ChatService's observable slice) so there are no stale-closure hazards.
 * Routes events to the active session's observable list or the background-
 * session cache, and delegates per-message mutation to the pure functions in
 * `chat-event-mutators.ts`.
 *
 * Native event objects remain unchanged; this is a display selector, not a
 * second runtime protocol.
 */

import {
  selectLastAssistantMessage,
  selectNativeToolCall,
  selectNativeToolResult,
  selectNativeToolUpdate,
  type PublicRuntimeEvent,
} from '@svton/agent-core';
import type { MessageStoreHost } from './chat-message-store';
import {
  applyPlanProgressToStore,
  findStreamingMessage,
  isActiveSessionStreaming,
  mapStreamingMessage,
  updateToolCallStatusEverywhere,
} from './chat-message-store';
import type { ApprovalQueue } from './chat-approval-queue';
import type { DisplayMessage } from '../types';
import {
  applyError,
  applySkillActivated,
  applyTextDelta,
  applyThinkingDelta,
  applyToolCallEnd,
  applyToolExecutionUpdate,
  applyToolCallStart,
  applyTurnFinalized,
  applyWarning,
  CONTEXT_COMPACTED_LABEL,
  type MutatorContext,
} from './chat-event-mutators';

export interface EventHandlerDeps {
  approvals: ApprovalQueue;
  /** Factory for the context_compacted system marker. */
  createSystemMessage: (text: string, systemType: string) => DisplayMessage;
}

export class ChatEventHandler {
  private thinkingSeparatorPending = false;

  constructor(private deps: EventHandlerDeps) {}

  handle(
    event: PublicRuntimeEvent,
    assistantMsgId: string,
    store: MessageStoreHost,
  ): void {
    const ctx: MutatorContext = {
      assistantMsgId,
      insertThinkingSeparator: this.thinkingSeparatorPending,
    };

    switch (event.type) {
      case 'message_update': {
        const update = event.assistantMessageEvent;
        if (update.type === 'text_delta') {
          mapStreamingMessage(store, (m) => applyTextDelta(m, update.delta, ctx));
        } else if (update.type === 'thinking_delta') {
          mapStreamingMessage(store, (m) => applyThinkingDelta(m, update.delta, ctx));
          this.thinkingSeparatorPending = false;
        }
        break;
      }

      case 'tool_execution_start': {
        const call = selectNativeToolCall(event);
        const toolCall = { ...call, status: 'running' as const };
        mapStreamingMessage(store, (m) => applyToolCallStart(m, toolCall, ctx));
        break;
      }
      case 'tool_execution_update': {
        const update = selectNativeToolUpdate(event);
        mapStreamingMessage(store, (m) =>
          m.id === assistantMsgId ? applyToolExecutionUpdate(m, update) : m,
        );
        break;
      }
      case 'tool_execution_end': {
        const result = selectNativeToolResult(event);
        const owningMsg = findStreamingMessage(store, assistantMsgId);
        const owningCall = owningMsg?.toolCalls?.find((tool) => tool.id === result.callId);
        const toolName = owningCall?.name ?? event.toolName;
        mapStreamingMessage(store, (m) =>
          m.id === assistantMsgId ? applyToolCallEnd(m, result, toolName, owningCall) : m,
        );
        applyPlanProgressToStore(store, result, assistantMsgId);
        this.thinkingSeparatorPending = true;
        break;
      }

      // --- svton-only: approval gate ---
      case 'tool_approval_needed':
        store.status = 'waiting_approval';
        this.deps.approvals.set(event.call.id, {
          call: event.call,
          ...(event.metadata ? { metadata: event.metadata } : {}),
          resolve: () => {},
        });
        updateToolCallStatusEverywhere(store, event.call.id, 'pending_approval', event.metadata);
        break;

      case 'message_end':
        if (event.message.role !== 'assistant') break;
        store.lastUsage = event.message.usage;
        if (event.message.stopReason === 'error') {
          const error = event.message.errorMessage ?? 'Agent run failed';
          mapStreamingMessage(store, (m) => applyError(m, error, ctx));
        }
        break;
      case 'agent_end': {
        const assistant = selectLastAssistantMessage(event.messages);
        if (assistant) store.lastUsage = assistant.usage;
        mapStreamingMessage(store, (m) => applyTurnFinalized(m, ctx));
        break;
      }

      // --- svton-only: compaction (UI-only system marker) ---
      case 'context_compacted':
        if (isActiveSessionStreaming(store)) {
          const sysMsg = this.deps.createSystemMessage(CONTEXT_COMPACTED_LABEL, 'context_compacted');
          store.messages = [...store.messages, sysMsg];
        }
        break;

      // --- svton-only: product warnings + skill activation ---
      case 'warning':
        mapStreamingMessage(store, (m) => applyWarning(m, event.text, event.source, ctx));
        break;
      case 'skill_activated':
        mapStreamingMessage(store, (m) => applySkillActivated(m, event.skills, ctx));
        break;

      case 'agent_start':
      case 'turn_start':
      case 'turn_end':
      case 'message_start':
        break;
    }

  }

  /** Reset streaming-state tracking between runs. */
  resetSequenceState(): void {
    this.thinkingSeparatorPending = false;
  }
}
