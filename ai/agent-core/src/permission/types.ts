/**
 * Permission system types.
 */

export type PermissionMode = 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';

export interface PermissionRule {
  tool: string;               // Tool name pattern, e.g. "Bash" or "Bash(git *)"
  effect: 'allow' | 'ask' | 'deny';
  /** Policy-authored non-secret key eligible for an in-memory session grant. */
  sessionScopeKey?: string;
}

export interface PermissionConfig {
  mode: PermissionMode;
  rules: PermissionRule[];
}

export interface PermissionDecision {
  allowed: boolean;
  needsApproval: boolean;
  reason?: string;
  sessionScopeKey?: string;
}
