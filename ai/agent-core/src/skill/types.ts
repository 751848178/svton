/**
 * Skill system types.
 */

export type SkillScope = 'repo' | 'user' | 'admin' | 'system';

export interface SkillTrigger {
  /** Explicit: /skill-name. Implicit: auto-matched */
  type: 'explicit' | 'implicit';
  /** Keywords/patterns for implicit matching */
  patterns?: string[];
}

export interface SkillDefinition {
  /** Unique skill name (e.g. "create-api-endpoint") */
  name: string;
  /** One-line description (injected into system prompt, ~2% context budget) */
  description: string;
  /** Full instructions (loaded on demand) */
  instructions: string;
  /** Scope level */
  scope: SkillScope;
  /** Trigger configuration */
  trigger?: SkillTrigger;
  /** Tools required by this skill */
  requiredTools?: string[];
  /** Platform capabilities required */
  requiredCapabilities?: string[];
}

/**
 * Summary entry used in system prompt injection.
 */
export interface SkillSummary {
  name: string;
  description: string;
}
