/**
 * @svton/agent-sdk/react — React integration for the AI Agent SDK.
 *
 * ```tsx
 * import { AgentProvider, useChat } from '@svton/agent-sdk/react';
 * ```
 */

// Provider
export { AgentProvider } from './context';
export type { AgentProviderProps } from './context';

// Hooks
export { useAgent } from './use-agent';
export type { UseAgentReturn } from './use-agent';

export { useChat } from './use-chat';
export type { UseChatReturn } from './use-chat';

export { useToolApproval } from './use-tool-approval';
export type { UseToolApprovalReturn } from './use-tool-approval';

// Types
export type {
  ChatStatus,
  DisplayMessage,
  DisplayToolCall,
  ContentBlock,
} from './types';

// Re-export SDK config type (for AgentProvider props)
export type { CreateAgentConfig, UserToolDefinition, ProviderConfig, SdkMcpServerConfig } from '../types';
