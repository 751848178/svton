/**
 * Hooks lifecycle types.
 */

export type HookEvent =
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'permission_request'
  | 'session_start'
  | 'session_end'
  | 'context_compact'
  | 'message_sent'
  | 'message_received';

export interface HookContext {
  event: HookEvent;
  toolName?: string;
  toolCall?: import('../tool/types').ToolCall;
  toolResult?: import('../tool/types').ToolResult;
  [key: string]: unknown;
}

export type HookResult =
  | { action: 'continue' }
  | { action: 'modify'; updates: Record<string, unknown> }
  | { action: 'deny'; reason: string }
  | { action: 'approve' };

export type HookHandler = (ctx: HookContext) => Promise<HookResult>;

export interface HookConfig {
  event: HookEvent;
  handler: HookHandler;
  id?: string;
  priority?: number;
}
