/** Projects native runtime events into the active or background display store. */

import {
  selectNativeToolCall,
  selectNativeToolResult,
  selectNativeToolUpdate,
  type PublicRuntimeEvent,
  type ToolApprovalDecision,
  type ToolApprovalRequest,
} from '@svton/agent-core';
import type { MessageStoreHost } from './chat-message-store';
import {
  appendSessionMessage,
  findStreamingMessage,
  isActiveSessionStreaming,
  mapStreamingMessage,
} from './chat-message-store';
import { applyPlanProgressToStore } from './chat-message-owner-projection';
import type { ApprovalQueue } from './chat-approval-queue';
import type { ChatUserInputStore } from './chat-user-input-store';
import type { DisplayMessage } from '../types';
import { toSecretSafeDisplayResult } from './chat-user-input-result.utils';
import {
  decisionEventSessionId,
  eventBelongsToRun,
  normalizeApprovalEvent,
} from './chat-event-context';
import { projectProviderFailure } from './chat-provider-failure';
import { projectTimelineEvent } from './chat-timeline-event-projection';
import type { ChatRunAddress } from './chat-run.types';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import { projectDecisionEvent } from './chat-decision-event-handler';
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
  userInputs: ChatUserInputStore;
  captureApprovalSettlement: (
    request: ToolApprovalRequest,
    address?: ChatRunAddress,
  ) => (decision: ToolApprovalDecision) => boolean;
  captureUserInputResponse: (
    address?: ChatRunAddress,
  ) => ((requestId: string, answers: import('@svton/agent-core').UserInputAnswers) => boolean) | undefined;
  /** Factory for the context_compacted system marker. */
  createSystemMessage: (text: string, systemType: string) => DisplayMessage;
  runs: ChatRunCoordinatorService;
}

export class ChatEventHandler {
  private readonly thinkingSeparatorPending = new Set<string>();

  constructor(private deps: EventHandlerDeps) {}

  handle(
    event: PublicRuntimeEvent,
    assistantMsgId: string,
    store: MessageStoreHost,
    address?: ChatRunAddress,
  ): void {
    if (address && !this.deps.runs.acceptsEvents(address)) return;
    event = normalizeApprovalEvent(event, store, address);
    const eventSessionId = decisionEventSessionId(event);
    if (eventSessionId && !eventBelongsToRun(address, eventSessionId)) return;
    const sequenceKey = runKey(address);
    const ctx: MutatorContext = {
      assistantMsgId,
      insertThinkingSeparator: this.thinkingSeparatorPending.has(sequenceKey),
    };
    projectTimelineEvent(event, assistantMsgId, store, address);
    if (projectDecisionEvent(event, assistantMsgId, store, address, this.deps)) return;

    switch (event.type) {
      case 'message_update': {
        const update = event.assistantMessageEvent;
        if (update.type === 'text_delta') {
          mapStreamingMessage(store, (m) => applyTextDelta(m, update.delta, ctx), address?.sessionId);
        } else if (update.type === 'thinking_delta') {
          mapStreamingMessage(store, (m) => applyThinkingDelta(m, update.delta, ctx), address?.sessionId);
          this.thinkingSeparatorPending.delete(sequenceKey);
        }
        break;
      }

      case 'tool_execution_start': {
        const call = selectNativeToolCall(event);
        const toolCall = { ...call, status: 'running' as const };
        mapStreamingMessage(store, (m) => applyToolCallStart(m, toolCall, ctx), address?.sessionId);
        break;
      }
      case 'tool_execution_update': {
        const update = selectNativeToolUpdate(event);
        mapStreamingMessage(store, (m) =>
          m.id === assistantMsgId ? applyToolExecutionUpdate(m, update) : m,
        address?.sessionId);
        break;
      }
      case 'tool_execution_end': {
        const result = selectNativeToolResult(event);
        const owningMsg = findStreamingMessage(store, assistantMsgId, address?.sessionId);
        const owningCall = owningMsg?.toolCalls?.find((tool) => tool.id === result.callId);
        const toolName = owningCall?.name ?? event.toolName;
        const displayResult = toSecretSafeDisplayResult(toolName, result);
        mapStreamingMessage(store, (m) =>
          m.id === assistantMsgId ? applyToolCallEnd(m, displayResult, toolName, owningCall) : m,
        address?.sessionId);
        applyPlanProgressToStore(store, displayResult, assistantMsgId, address?.sessionId);
        this.thinkingSeparatorPending.add(sequenceKey);
        break;
      }

      case 'message_end':
        if (event.message.role !== 'assistant') break;
        if (event.message.stopReason === 'error') {
          const error = event.message.errorMessage ?? 'Agent run failed';
          mapStreamingMessage(store, (m) => applyError(m, error, ctx), address?.sessionId);
        }
        break;
      case 'agent_end':
        // Terminal display publication is owned atomically by chat-stream-runner
        // after the generator and durable finalizing journal have settled.
        if (!address) {
          mapStreamingMessage(store, (m) => applyTurnFinalized(m, ctx));
        }
        break;

      // --- svton-only: compaction (UI-only system marker) ---
      case 'context_compacted':
        appendSessionMessage(
          store,
          address?.sessionId ?? store.backgroundSessionId,
          this.deps.createSystemMessage(CONTEXT_COMPACTED_LABEL, 'context_compacted'),
        );
        break;

      // --- svton-only: product warnings + skill activation ---
      case 'warning':
        mapStreamingMessage(store, (m) => applyWarning(m, event.text, event.source, ctx), address?.sessionId);
        break;
      case 'skill_activated':
        mapStreamingMessage(store, (m) => applySkillActivated(m, event.skills, ctx), address?.sessionId);
        break;

      case 'agent_start':
      case 'turn_start':
      case 'turn_end':
      case 'message_start':
      case 'tool_approval_needed':
      case 'tool_approval_settled':
      case 'user_input_requested':
      case 'user_input_settled':
        break;
    }
  }

  handleProviderFailure(
    error: string,
    assistantMsgId: string,
    store: MessageStoreHost,
    address?: ChatRunAddress,
  ): void {
    projectProviderFailure(error, assistantMsgId, store, address);
  }

  resetSequenceState(address?: ChatRunAddress): void {
    this.thinkingSeparatorPending.delete(runKey(address));
  }
}

function runKey(address?: ChatRunAddress): string {
  return address ? `${address.sessionId ?? '<null>'}\u0000${address.runId}` : '<legacy>';
}
