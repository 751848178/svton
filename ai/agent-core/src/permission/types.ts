/**
 * Permission system types.
 */

export type PermissionMode = 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';

export interface PermissionRule {
  tool: string;               // Tool name pattern, e.g. "Bash" or "Bash(git *)"
  effect: 'allow' | 'ask' | 'deny';
}

export interface PermissionConfig {
  mode: PermissionMode;
  rules: PermissionRule[];
}

export interface PermissionDecision {
  allowed: boolean;
  needsApproval: boolean;
  reason?: string;
}

export interface PermissionToolMetadata {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}
