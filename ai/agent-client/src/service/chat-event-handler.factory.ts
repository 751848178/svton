import type { DisplayMessage } from '../types';
import type { ChatApprovalController } from './chat-approval-controller';
import type { ApprovalQueue } from './chat-approval-queue';
import { ChatEventHandler } from './chat-event-handler';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { ChatUserInputStore } from './chat-user-input-store';
import type { UserInputAnswers } from '@svton/agent-core';
import type { ChatRunAddress } from './chat-run.types';

/** Wires the event projector without making ChatService own projection policy. */
export function createChatEventHandler(
  approvals: ApprovalQueue,
  userInputs: ChatUserInputStore,
  approvalController: ChatApprovalController,
  runs: ChatRunCoordinatorService,
  captureUserInputResponse: (
    address?: ChatRunAddress,
  ) => ((requestId: string, answers: UserInputAnswers) => boolean) | undefined,
  createSystemMessage: (text: string, systemType: string) => DisplayMessage,
): ChatEventHandler {
  return new ChatEventHandler({
    approvals,
    userInputs,
    runs,
    captureApprovalSettlement: (request, address) => approvalController.captureSettlement(request, address),
    captureUserInputResponse,
    createSystemMessage,
  });
}
