/**
 * Chat event handler — dispatches a single `AgentEvent` to the message store.
 *
 * Stateless dispatcher: each `handle()` call receives the live message-store
 * host (ChatService's observable slice) so there are no stale-closure hazards.
 * Routes events to the active session's observable list or the background-
 * session cache, and delegates per-message mutation to the pure functions in
 * `chat-event-mutators.ts`.
 *
 * Event classification (Architecture §5.2):
 *   Pi-base (text, thinking, tool_call lifecycle, error, done): delegate to mutators.
 *   svton-only (tool_approval_needed, context_compacted, skill_activated,
 *   warning): handled here (they touch capability/UI state, not just blocks).
 */

import type { AgentEvent } from '@svton/agent-core';
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
  applyDone,
  applyError,
  applySkillActivated,
  applyTextDelta,
  applyThinkingDelta,
  applyToolCallEnd,
  applyToolCallProgress,
  applyToolCallStart,
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
  private lastEventType: string | null = null;

  constructor(private deps: EventHandlerDeps) {}

  handle(
    event: AgentEvent,
    assistantMsgId: string,
    store: MessageStoreHost,
  ): void {
    const ctx: MutatorContext = { assistantMsgId, lastEventType: this.lastEventType };

    switch (event.type) {
      // --- Pi-base: streaming content ---
      case 'text_delta':
        mapStreamingMessage(store, (m) => applyTextDelta(m, event, ctx));
        break;
      case 'thinking_delta':
        mapStreamingMessage(store, (m) => applyThinkingDelta(m, event, ctx));
        break;

      // --- Pi-base: tool-call lifecycle ---
      case 'tool_call_start':
        mapStreamingMessage(store, (m) => applyToolCallStart(m, event, ctx));
        break;
      case 'tool_call_progress':
        if (event.arguments || event.name) {
          mapStreamingMessage(store, (m) =>
            m.id === assistantMsgId ? applyToolCallProgress(m, event) : m,
          );
        }
        break;
      case 'tool_call_end': {
        const owningMsg = findStreamingMessage(store, assistantMsgId);
        const owningCall = owningMsg?.toolCalls?.find((t) => t.id === event.result.callId);
        const toolName = owningCall?.name || '';
        mapStreamingMessage(store, (m) =>
          m.id === assistantMsgId ? applyToolCallEnd(m, event, toolName, owningCall) : m,
        );
        applyPlanProgressToStore(store, event.result, assistantMsgId);
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

      // --- Pi-base: termination ---
      case 'error':
        mapStreamingMessage(store, (m) => applyError(m, event, ctx));
        break;
      case 'done':
        store.lastUsage = event.usage;
        mapStreamingMessage(store, (m) => applyDone(m, ctx));
        break;

      // --- svton-only: compaction (UI-only system marker) ---
      case 'context_compacted':
        if (isActiveSessionStreaming(store)) {
          const sysMsg = this.deps.createSystemMessage(CONTEXT_COMPACTED_LABEL, 'context_compacted');
          store.messages = [...store.messages, sysMsg];
        }
        break;

      // --- svton-only: product warnings + skill activation ---
      case 'warning':
        mapStreamingMessage(store, (m) => applyWarning(m, event, ctx));
        break;
      case 'skill_activated':
        mapStreamingMessage(store, (m) => applySkillActivated(m, event, ctx));
        break;
    }

    this.lastEventType = event.type;
  }

  /** Reset streaming-state tracking between runs. */
  resetLastEventType(): void {
    this.lastEventType = null;
  }
}
