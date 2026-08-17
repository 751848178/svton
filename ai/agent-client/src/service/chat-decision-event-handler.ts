import type {
  PublicRuntimeEvent,
  ToolApprovalDecision,
  ToolApprovalRequest,
} from '@svton/agent-core';
import type { ApprovalQueue } from './chat-approval-queue';
import { hasProjectedLiveApproval } from './chat-event-context';
import { mapStreamingMessage, type MessageStoreHost } from './chat-message-store';
import { updateMessageToolCallStatus } from './chat-message-tool-status.utils';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { ChatRunAddress } from './chat-run.types';
import type { ChatUserInputStore } from './chat-user-input-store';

interface DecisionEventDeps {
  approvals: ApprovalQueue;
  userInputs: ChatUserInputStore;
  runs: ChatRunCoordinatorService;
  captureApprovalSettlement: (
    request: ToolApprovalRequest,
    address?: ChatRunAddress,
  ) => (decision: ToolApprovalDecision) => boolean;
  captureUserInputResponse: (
    address?: ChatRunAddress,
  ) => ((requestId: string, answers: import('@svton/agent-core').UserInputAnswers) => boolean) | undefined;
}

/** Projects decision events to their exact queue and addressed run. */
export function projectDecisionEvent(
  event: PublicRuntimeEvent,
  assistantMsgId: string,
  store: MessageStoreHost,
  address: ChatRunAddress | undefined,
  deps: DecisionEventDeps,
): boolean {
  if (event.type === 'tool_approval_needed') {
    const { request } = event;
    if (!hasProjectedLiveApproval(store, assistantMsgId, request, address)) return true;
    const enqueued = deps.approvals.enqueue(
      request,
      deps.captureApprovalSettlement(request, address),
    );
    if (enqueued && address) deps.runs.requestApproval(address, request.requestId);
    mapStreamingMessage(store, (message) => updateMessageToolCallStatus(
      message, request.itemId, 'pending_approval', request.metadata,
    ), address?.sessionId);
    return true;
  }
  if (event.type === 'tool_approval_settled') {
    const { settlement } = event;
    deps.approvals.observeSettlement(settlement);
    if (address) deps.runs.settleApproval(address, settlement.requestId);
    mapStreamingMessage(store, (message) => updateMessageToolCallStatus(
      message,
      settlement.itemId,
      settlement.decision === 'accept' || settlement.decision === 'acceptForSession'
        ? 'running'
        : 'error',
    ), address?.sessionId);
    return true;
  }
  if (event.type === 'user_input_requested') {
    if (deps.userInputs.enqueue(event.request, deps.captureUserInputResponse(address)) && address) {
      deps.runs.requestUserInput(address, event.request.requestId);
    }
    return true;
  }
  if (event.type === 'user_input_settled') {
    deps.userInputs.settle(event.sessionId, event.requestId, event.settlement);
    if (address) deps.runs.settleUserInput(address, event.requestId);
    return true;
  }
  return false;
}
