/**
 * @svton/agent-client
 *
 * React integration layer for Svton AI Agent.
 */

// Provider
export { AgentProvider, useAgentContext, globalFlush } from './service/provider';

// Services (for direct usage)
export { ChatService } from './service/chat.service';
export type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress } from './service/chat.service';
export type { ChatPreparedInput, PublicComposerAttachment } from './service/chat-prepared-input.types';
export { SessionService } from './service/session.service';
export type { SessionInfo, SessionData } from './service/session.service';
export type * from './service/session-management.types';
export type * from './service/session-search.types';
export type { SessionScope } from './service/session-management-selectors';
export type * from './service/session-activity.types';
export { selectSessionActivity } from './service/session-activity.reducer';
export type * from './startup/startup-state';
export { useStartupTask } from './startup/use-startup-task';
export type { StartupTaskController } from './startup/use-startup-task';
export { ProjectService } from './service/project.service';

// Types
export type { Project, ContentBlock } from './types';
export type * from './timeline/types';
export { reduceTimeline, isTerminalTimelineStatus } from './timeline/lifecycle.reducer';
export { selectTimelineActions, createProviderFailureAction } from './timeline/public-event-selector';
export { serializeTimeline, deserializeTimeline } from './timeline/serialization';
export { migrateLegacyMessageTimeline } from './timeline/legacy-compatibility';
export type * from './service/chat-run.types';
export type { ChatComposerMode, ChatComposerState, PendingDecisionSummary } from './service/chat-run-selectors';
export { selectCompatibilityStatus, selectComposerState, selectPendingDecision } from './service/chat-run-selectors';
export type * from './model-switch/model-switch.types';
export {
  decodeModelKey,
  encodeModelKey,
  modelKeysEqual,
} from './model-switch/model-switch.types';
export type * from './model-switch/model-switch-host.types';
export type * from './permission-profile/permission-profile.types';
export type * from './permission-profile/permission-profile-host.types';
export {
  ModelSwitchTransactionService,
  type ModelSwitchBindings,
} from './model-switch/model-switch-transaction.service';
export { MAX_PUBLIC_MODEL_SWITCH_ERROR, toPublicModelSwitchError } from './model-switch/model-switch-public-error';

// Hooks
export { useAgent } from './hooks/useAgent';
export { useChat } from './hooks/useChat';
export { useSession } from './hooks/useSession';
export { useToolApproval } from './hooks/useTool';
export { useUserInput } from './hooks/useUserInput';
export type { PendingUserInputRequest, PendingUserInputState } from './service/chat-user-input-store';
