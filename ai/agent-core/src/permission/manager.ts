import type { PermissionMode, PermissionRule, PermissionConfig, PermissionDecision } from './types';
import type { ToolCall } from '../tool/types';
import { matchesPermissionGlob } from './permission-glob.utils';
import { canonicalSessionId } from '../agent/session-id';
import { validateSessionScopeKey } from './session-scope';

export interface PermissionCheckContext {
  sessionId?: string;
}

/**
 * Manages tool call permissions.
 *
 * Rule precedence: deny > ask > allow
 * Mode determines default behavior:
 * - read_only: deny everything except read-only tools
 * - plan: allow reads, ask for everything else
 * - default: allow reads, ask for edits and commands
 * - accept_edits: allow reads + edits, ask for commands
 * - auto: allow everything
 */
export class PermissionManager {
  private mode: PermissionMode;
  private rules: PermissionRule[];
  private readonly sessionGrants = new Set<string>();

  constructor(config?: Partial<PermissionConfig>) {
    this.mode = config?.mode ?? 'default';
    this.rules = config?.rules ?? [];
  }

  /**
   * Check if a tool call is allowed.
   */
  check(toolCall: ToolCall, context?: PermissionCheckContext): PermissionDecision {
    // Asking the user is a blocking interaction, not a privileged side effect.
    if (toolCall.name === 'request_user_input') {
      return { allowed: true, needsApproval: false };
    }
    // Auto mode allows everything
    if (this.mode === 'auto') {
      return { allowed: true, needsApproval: false };
    }

    // Check explicit rules first (deny > ask > allow precedence)
    const matchedRules = this.rules.filter((r) => this.matchesRule(r, toolCall));

    const denyRule = matchedRules.find((r) => r.effect === 'deny');
    if (denyRule) {
      return { allowed: false, needsApproval: false, reason: `Denied by rule: ${denyRule.tool}` };
    }

    const askRule = matchedRules.find((r) => r.effect === 'ask');
    if (askRule) {
      const sessionScopeKey = validateSessionScopeKey(askRule.sessionScopeKey);
      if (sessionScopeKey && this.hasSessionGrant(context?.sessionId, sessionScopeKey)) {
        return { allowed: true, needsApproval: false, sessionScopeKey };
      }
      return {
        allowed: true,
        needsApproval: true,
        reason: `Requires approval: ${askRule.tool}`,
        ...(sessionScopeKey ? { sessionScopeKey } : {}),
      };
    }

    const allowRule = matchedRules.find((r) => r.effect === 'allow');
    if (allowRule) {
      return { allowed: true, needsApproval: false };
    }

    // Fall back to mode-based defaults
    return this.getModeDefault(toolCall);
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  /** Copy durable policy into a runtime-local manager without session grants. */
  forkForRuntime(): PermissionManager {
    return new PermissionManager({
      mode: this.mode,
      rules: this.rules.map((rule) => ({ ...rule })),
    });
  }

  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  removeRule(tool: string): void {
    this.rules = this.rules.filter((r) => r.tool !== tool);
  }

  grantForSession(sessionId: string | undefined, sessionScopeKey: unknown): boolean {
    const scope = validateSessionScopeKey(sessionScopeKey);
    if (!scope) return false;
    const explicitlyConfigured = this.rules.some((rule) => (
      rule.effect === 'ask' && validateSessionScopeKey(rule.sessionScopeKey) === scope
    ));
    if (!explicitlyConfigured) return false;
    this.sessionGrants.add(this.sessionGrantKey(sessionId, scope));
    return true;
  }

  clearSessionGrants(sessionId?: string): void {
    if (sessionId === undefined) {
      this.sessionGrants.clear();
      return;
    }
    const prefix = `${canonicalSessionId(sessionId)}\u0000`;
    for (const key of this.sessionGrants) {
      if (key.startsWith(prefix)) this.sessionGrants.delete(key);
    }
  }

  private hasSessionGrant(sessionId: string | undefined, scope: string): boolean {
    return this.sessionGrants.has(this.sessionGrantKey(sessionId, scope));
  }

  private sessionGrantKey(sessionId: string | undefined, scope: string): string {
    return `${canonicalSessionId(sessionId)}\u0000${scope}`;
  }

  private matchesRule(rule: PermissionRule, toolCall: ToolCall): boolean {
    const pattern = rule.tool;

    // Exact match
    if (pattern === toolCall.name) return true;

    // Pattern match: "Tool(specifier)"
    const match = pattern.match(/^(.+?)\((.+)\)$/);
    if (match) {
      const [, toolName, specifier] = match;
      if (toolName !== toolCall.name) return false;

      // Simple glob matching for specifier
      const args = JSON.stringify(toolCall.arguments);
      return matchesPermissionGlob(specifier, args);
    }

    return false;
  }

  private getModeDefault(toolCall: ToolCall): PermissionDecision {
    const name = toolCall.name;
    const readOnlyTools = ['file_read', 'grep', 'glob', 'web_search', 'web_fetch', 'screenshot', 'chrome_screenshot', 'chrome_get_content', 'scroll', 'mouse_move'];
    const editTools = ['file_write', 'file_edit'];

    switch (this.mode) {
      case 'read_only':
        if (readOnlyTools.includes(name)) {
          return { allowed: true, needsApproval: false };
        }
        return { allowed: false, needsApproval: false, reason: 'Read-only mode' };

      case 'plan':
        if (readOnlyTools.includes(name)) {
          return { allowed: true, needsApproval: false };
        }
        return { allowed: false, needsApproval: false, reason: 'Plan mode - no modifications allowed' };

      case 'default':
        if (readOnlyTools.includes(name)) {
          return { allowed: true, needsApproval: false };
        }
        return { allowed: true, needsApproval: true, reason: 'Requires approval' };

      case 'accept_edits':
        if (readOnlyTools.includes(name) || editTools.includes(name)) {
          return { allowed: true, needsApproval: false };
        }
        return { allowed: true, needsApproval: true, reason: 'Requires approval' };

      default:
        return { allowed: true, needsApproval: true };
    }
  }
}
