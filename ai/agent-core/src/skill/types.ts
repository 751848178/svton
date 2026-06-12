/**
 * Skill system types.
 *
 * Aligned with Agent Skills Open Standard (agentskills.io)
 * and extended with Claude Code / Codex CLI patterns.
 */

// ── Scope & Source ──────────────────────────────────────

export type SkillScope = 'project' | 'user' | 'admin' | 'system';

/**
 * Where a skill was installed from.
 */
export type SkillSource =
  | { type: 'builtin' }                            // Bundled with the app
  | { type: 'storage' }                            // Created by user via UI
  | { type: 'url'; url: string }                   // Installed from URL
  | { type: 'git'; repo: string; ref?: string }    // Installed from git repo
  | { type: 'local'; path: string };               // Installed from local directory

// ── Trigger ─────────────────────────────────────────────

export interface SkillTrigger {
  /** Explicit: /skill-name. Implicit: auto-matched */
  type: 'explicit' | 'implicit';
  /** Keywords/patterns for implicit matching */
  patterns?: string[];
}

// ── Skill Definition ────────────────────────────────────

export interface SkillDefinition {
  /** Unique skill name (kebab-case, e.g. "create-api-endpoint") */
  name: string;
  /** One-line description (injected into system prompt, ~2% context budget) */
  description: string;
  /** Full instructions (loaded on demand) */
  instructions: string;
  /** Scope level */
  scope: SkillScope;
  /** Trigger configuration */
  trigger?: SkillTrigger;

  // ── Tool dependencies ──
  /** Tools required by this skill */
  requiredTools?: string[];
  /** Platform capabilities required */
  requiredCapabilities?: string[];

  // ── Skill-scoped permissions (Claude Code pattern) ──
  /** When active, only these tools are available */
  allowedTools?: string[];
  /** When active, these tools are removed */
  disallowedTools?: string[];

  // ── Structured trigger signals ──
  /** When to activate this skill */
  whenToUse?: string[];
  /** When NOT to activate this skill */
  avoidWhen?: string[];
  /** Keywords that signal this skill is relevant */
  triggerSignals?: string[];

  // ── Installation metadata ──
  /** Version for update tracking */
  version?: string;
  /** Where this skill came from */
  source?: SkillSource;
}

// ── Installation Record ─────────────────────────────────

export interface SkillInstallRecord {
  name: string;
  source: SkillSource;
  installedAt: number;
  version?: string;
}

// ── Summary (used in system prompt) ─────────────────────

export interface SkillSummary {
  name: string;
  description: string;
}
