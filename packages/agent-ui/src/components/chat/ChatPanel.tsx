import React, { useEffect, useRef } from 'react';
import { cn } from '@svton/ui';
import { ChatInput } from './ChatInput';
import { ChatDecisionSurface } from './ChatDecisionSurface';
import { ChatPanelConversation } from './ChatPanelConversation';
import { ChatStatusAnnouncer } from './ChatStatusAnnouncer';
import { PlanPanel } from './PlanPanel';
import { useInert } from '../use-inert';
import type { ChatPanelMessage, ChatPanelProps, PresetItem } from './chat-panel.types';
export type { ChatPanelMessage, ChatPanelProps, PresetItem } from './chat-panel.types';

/** Complete chat panel composed from transcript, composer, and typed decision surfaces. */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  interaction,
  onSend,
  onAbort,
  onApproveTool,
  onRejectTool,
  approvalRequest,
  onApprovalDecision,
  userInputRequest,
  onSubmitUserInput,
  onUserInputDraftChange,
  onRetry,
  onEditMessage,
  onOpenEditor,
  onOpenDocument,
  onOpenReference,
  artifactInteraction,
  onTimelineIntent,
  timelineCapabilities,
  isStreaming,
  disabled,
  disabledReason,
  placeholder,
  emptyMessage,
  presets,
  inputLeadingSlot,
  inputTrailingSlot,
  slashCommands,
  mentionItems,
  onMentionSelect,
  onFileReference,
  inputHistory,
  activePlan,
  className,
}) => {
  const paneContentRef = useRef<HTMLDivElement>(null);
  const restoreComposerRef = useRef(false);
  const previousDecisionRef = useRef(false);
  const hasLocalDecision = Boolean(userInputRequest);
  const hasDecision = Boolean(userInputRequest || approvalRequest);
  const decisionAnnouncement = userInputRequest
    ? { kind: 'requestInput' as const, key: `request-input:${userInputRequest.sessionId}:${userInputRequest.requestId}` }
    : approvalRequest
      ? { kind: 'approval' as const, key: `approval:${approvalRequest.sessionId}:${approvalRequest.requestId}` }
      : null;
  useInert(paneContentRef, hasLocalDecision);

  useEffect(() => {
    const hadDecision = previousDecisionRef.current;
    previousDecisionRef.current = hasDecision;
    if (hasDecision) {
      restoreComposerRef.current = false;
      return;
    }
    if (hadDecision) restoreComposerRef.current = true;
    if (!restoreComposerRef.current || disabled || isStreaming) return;
    const timer = window.setTimeout(() => {
      if (document.activeElement !== document.body) {
        restoreComposerRef.current = false;
        return;
      }
      const composer = paneContentRef.current?.querySelector<HTMLTextAreaElement>(
        '[data-testid="chat-input"]',
      );
      composer?.focus();
      if (document.activeElement === composer) restoreComposerRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [disabled, hasDecision, isStreaming]);

  return (
    <div className={cn('relative isolate flex h-full flex-col', className)}>
      <ChatStatusAnnouncer messages={messages} isStreaming={Boolean(isStreaming)} decision={decisionAnnouncement} />
      <div
        ref={paneContentRef}
        data-testid="chat-pane-content"
        className="flex min-h-0 flex-1 flex-col"
        aria-hidden={hasLocalDecision ? true : undefined}
      >
        <ChatPanelConversation
          messages={messages}
          interaction={interaction}
          onSend={onSend}
          onApproveTool={onApproveTool}
          onRejectTool={onRejectTool}
          onRetry={onRetry}
          onEditMessage={onEditMessage}
          onOpenEditor={onOpenEditor}
          onOpenDocument={onOpenDocument}
          onOpenReference={onOpenReference}
          artifactInteraction={artifactInteraction}
          onTimelineIntent={onTimelineIntent}
          timelineCapabilities={timelineCapabilities}
          isStreaming={isStreaming}
          emptyMessage={emptyMessage}
          presets={presets}
        />
        {activePlan && activePlan.steps.length > 0 && <PlanPanel plan={activePlan} />}
        {disabled && disabledReason && (
          <p role="status" data-testid="chat-disabled-reason" className="px-6 pb-2 text-xs text-amber-300">
            {disabledReason}
          </p>
        )}
        <div className="mx-auto w-full max-w-[1472px] px-6">
          <ChatInput
            interaction={interaction}
            onSend={onSend}
            onAbort={onAbort}
            isStreaming={isStreaming}
            disabled={disabled}
            placeholder={placeholder}
            leadingSlot={inputLeadingSlot}
            trailingSlot={inputTrailingSlot}
            slashCommands={slashCommands}
            mentionItems={mentionItems}
            onMentionSelect={onMentionSelect}
            onFileReference={onFileReference}
            inputHistory={inputHistory}
          />
        </div>
      </div>
      <ChatDecisionSurface
        approvalRequest={approvalRequest}
        onApprovalDecision={onApprovalDecision}
        userInputRequest={userInputRequest}
        onSubmitUserInput={onSubmitUserInput}
        onUserInputDraftChange={onUserInputDraftChange}
        onAbort={onAbort}
      />
    </div>
  );
};
