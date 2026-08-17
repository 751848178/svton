import React from 'react';
import { ToolApprovalModal } from './ToolApprovalModal';
import { UserInputForm } from './UserInputForm';
import type { UserInputAnswerPayload, UserInputRequestView } from './user-input.types';
import type { ApprovalDecisionView, ApprovalRequestView } from './approval.types';

interface ChatDecisionSurfaceProps {
  approvalRequest?: ApprovalRequestView | null;
  onApprovalDecision?: (requestId: string, decision: ApprovalDecisionView) => void;
  userInputRequest?: UserInputRequestView | null;
  onSubmitUserInput?: (requestId: string, answers: UserInputAnswerPayload) => void;
  onUserInputDraftChange?: (requestId: string, questionId: string, value: string) => void;
  onAbort?: () => void;
}

export function ChatDecisionSurface(props: ChatDecisionSurfaceProps) {
  if (props.userInputRequest && props.onSubmitUserInput) {
    return <UserInputForm key={`${props.userInputRequest.sessionId}:${props.userInputRequest.requestId}`} request={props.userInputRequest} onSubmit={props.onSubmitUserInput} onDraftChange={props.onUserInputDraftChange} onAbort={props.onAbort} />;
  }
  if (props.approvalRequest && props.onApprovalDecision) {
    return (
      <ToolApprovalModal
        key={`${props.approvalRequest.sessionId}:${props.approvalRequest.requestId}`}
        request={props.approvalRequest}
        onDecision={props.onApprovalDecision}
      />
    );
  }
  return null;
}
