import {
  selectNativeToolCall,
  selectNativeToolResult,
  selectNativeToolUpdate,
  type PublicRuntimeEvent,
} from '@svton/agent-core';
import { createExecutionItem, normalizeToolOutcome } from './result-normalizer';
import {
  createFileOutcomeItem,
  isFileChangeTool,
  normalizeFileOutcomeFinish,
} from './file-outcome-normalizer';
import { isTimelineEligibleTool } from './eligibility';
import { boundProgressText, boundTimelineText } from './bounds';
import type { DiagnosticTimelineItem, TimelineAction } from './types';
import { selectUsageActions } from './usage-event-selector';

export interface TimelineEventContext {
  sessionId: string;
  turnId: string;
  retryMessageId?: string;
  now?: () => number;
}

export function selectTimelineActions(
  event: PublicRuntimeEvent,
  context: TimelineEventContext,
): TimelineAction[] {
  const at = (context.now ?? Date.now)();
  const owner = { sessionId: context.sessionId, turnId: context.turnId, at };
  switch (event.type) {
    case 'tool_approval_needed': {
      const { request } = event;
      const approvalOwner = {
        sessionId: request.sessionId,
        turnId: context.turnId,
        at: request.createdAt,
      };
      return [{
        ...approvalOwner,
        type: 'requestApproval',
        item: {
          id: request.requestId,
          requestId: request.requestId,
          itemId: request.itemId,
          sessionId: request.sessionId,
          turnId: context.turnId,
          kind: 'approvalDecision',
          lane: 'decision',
          status: 'awaitingApproval',
          title: `Approval requested for ${request.toolName}`,
          summary: request.reason,
          toolName: request.toolName,
          arguments: request.arguments,
          reason: request.reason,
          metadata: request.metadata,
          decisions: request.decisions,
          startedAt: request.createdAt,
          revision: 0,
        },
      }];
    }
    case 'tool_approval_settled': {
      const { settlement } = event;
      return [{
        type: 'settleApproval',
        sessionId: settlement.sessionId,
        turnId: context.turnId,
        requestId: settlement.requestId,
        decision: settlement.decision,
        at: settlement.settledAt,
      }];
    }
    case 'tool_execution_start': {
      const call = selectNativeToolCall(event);
      if (!isTimelineEligibleTool(call.name)) return [];
      const execution: TimelineAction = {
        ...owner,
        type: 'start',
        item: createExecutionItem({
          callId: call.id,
          toolName: call.name,
          arguments: call.arguments,
          ...owner,
        }),
      };
      const file = createFileOutcomeItem({
        callId: call.id,
        toolName: call.name,
        arguments: call.arguments,
        ...owner,
      });
      return file ? [execution, { ...owner, type: 'start', item: file }] : [execution];
    }
    case 'tool_execution_update': {
      const update = selectNativeToolUpdate(event);
      if (!isTimelineEligibleTool(event.toolName)) return [];
      const text = update.partialResult?.output
        ? boundProgressText(update.partialResult.output)
        : undefined;
      if (!text) return [];
      return [{
        ...owner,
        type: 'update',
        id: update.callId,
        progress: {
          id: `${update.callId}:${stableHash(text)}`,
          text,
          createdAt: at,
        },
      }];
    }
    case 'tool_execution_end': {
      if (!isTimelineEligibleTool(event.toolName)) return [];
      const result = selectNativeToolResult(event);
      const outcome = normalizeToolOutcome(event.toolName, context.retryMessageId, result);
      const execution: TimelineAction = {
        ...owner, type: 'finish', id: result.callId, ...outcome,
      };
      if (!isFileChangeTool(event.toolName)) return [execution];
      const file = normalizeFileOutcomeFinish(result.callId, outcome.status, result);
      return [execution, { ...owner, type: 'finishFileOutcome', ...file }];
    }
    case 'warning':
      return [{ ...owner, type: 'addOutcome', item: diagnosticItem(
        'warning', boundTimelineText(event.text), event.source, owner,
      ) }];
    case 'message_end': {
      const usage = selectUsageActions(event, owner);
      if (event.message.role !== 'assistant' || event.message.stopReason !== 'error') return usage;
      const isFallback = !event.message.errorMessage;
      const message = boundTimelineText(event.message.errorMessage ?? 'Agent run failed');
      return [...usage, {
        ...owner,
        type: 'failTurn',
        item: diagnosticItem(
          'error', message, isFallback ? 'agent_run_failed' : 'provider', owner,
          context.retryMessageId,
        ),
      }];
    }
    case 'agent_end':
      return [...selectUsageActions(event, owner), { ...owner, type: 'completeTurn' }];
    default:
      return [];
  }
}

export function createProviderFailureAction(
  message: string,
  context: TimelineEventContext,
): TimelineAction {
  const at = (context.now ?? Date.now)();
  const owner = { sessionId: context.sessionId, turnId: context.turnId, at };
  return {
    ...owner,
    type: 'failTurn',
    item: diagnosticItem(
      'error', boundTimelineText(message), 'provider', owner, context.retryMessageId,
    ),
  };
}

function diagnosticItem(
  kind: 'warning' | 'error',
  diagnostic: string,
  code: string | undefined,
  owner: { sessionId: string; turnId: string; at: number },
  retryMessageId?: string,
): DiagnosticTimelineItem {
  return {
    id: `${owner.turnId}:${kind}:${stableHash(`${code ?? ''}:${diagnostic}`)}`,
    sessionId: owner.sessionId,
    turnId: owner.turnId,
    kind,
    lane: 'outcome',
    status: kind === 'error' ? 'failed' : 'completed',
    title: kind === 'error' ? 'Provider error' : 'Warning',
    summary: diagnostic,
    diagnostic,
    code,
    startedAt: owner.at,
    completedAt: owner.at,
    revision: 0,
    ...(retryMessageId ? { retry: { kind: 'message', messageId: retryMessageId } } : {}),
  };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
