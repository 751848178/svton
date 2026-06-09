/**
 * @svton/agent-client
 *
 * React integration layer for Svton AI Agent.
 */

// Provider
export { AgentProvider, useAgentContext } from './service/provider';

// Services (for direct usage)
export { ChatService } from './service/chat.service';
export type { ChatStatus, DisplayMessage, DisplayToolCall, PlanProgress } from './service/chat.service';
export { SessionService } from './service/session.service';
export type { SessionInfo, SessionData } from './service/session.service';

// Hooks
export { useAgent } from './hooks/useAgent';
export { useChat } from './hooks/useChat';
export { useSession } from './hooks/useSession';
export { useToolApproval } from './hooks/useTool';
