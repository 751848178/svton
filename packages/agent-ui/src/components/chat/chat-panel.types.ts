import type React from 'react';
import type { ChatInputProps, MentionItem, SlashCommand } from './ChatInput';
import type { ChatMessageProps } from './chat-message.types';
import type { PlanInfo } from './PlanPanel';
import type { SplitScreenContent } from './SplitScreenPanel';
import type { UserInputAnswerPayload, UserInputRequestView } from './user-input.types';
import type { TimelineHostCapabilities, TimelineHostIntentHandler } from '../timeline/timeline.types';
import type { ApprovalDecisionView, ApprovalRequestView } from './approval.types';
import type { ComposerInteraction } from './composer.types';
import type { ArtifactInteraction } from '../artifacts/artifact.types';

export interface ChatPanelMessage extends Omit<
  ChatMessageProps,
  'onApproveTool' | 'onRejectTool' | 'className'
> {
  id: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface PresetItem {
  label: string;
  prompt: string;
}

export interface ChatPanelProps {
  messages: ChatPanelMessage[];
  interaction?: ComposerInteraction;
  onSend?: ChatInputProps['onSend'];
  onAbort?: () => void;
  onApproveTool?: (callId: string) => void;
  onRejectTool?: (callId: string) => void;
  approvalRequest?: ApprovalRequestView | null;
  onApprovalDecision?: (requestId: string, decision: ApprovalDecisionView) => void;
  userInputRequest?: UserInputRequestView | null;
  onSubmitUserInput?: (requestId: string, answers: UserInputAnswerPayload) => void;
  onUserInputDraftChange?: (requestId: string, questionId: string, value: string) => void;
  onRetry?: (messageId?: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onOpenEditor?: (content: string) => void;
  onOpenDocument?: (doc: SplitScreenContent) => void;
  onOpenReference?: (path: string, line?: number) => void;
  artifactInteraction?: ArtifactInteraction;
  onTimelineIntent?: TimelineHostIntentHandler;
  timelineCapabilities?: TimelineHostCapabilities;
  isStreaming?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  emptyMessage?: React.ReactNode;
  presets?: PresetItem[];
  inputLeadingSlot?: React.ReactNode;
  inputTrailingSlot?: React.ReactNode;
  slashCommands?: SlashCommand[];
  mentionItems?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => string;
  onFileReference?: () => void;
  inputHistory?: string[];
  matchedSkills?: string[];
  activePlan?: PlanInfo | null;
  className?: string;
}
