import type { SkillDefinition } from './types';
import {
  snapshotSkillDefinition,
  snapshotSkillDefinitions,
} from './skill-definition-snapshot.utils';
import { matchesSkillRequest } from './skill-match.service';

const CONTEXT_BUDGET_RATIO = 0.02; // ~2% of context for skill summaries
const DEFAULT_MAX_SUMMARY_CHARS = 8000;

/**
 * Manages skill definitions with progressive disclosure.
 *
 * Progressive disclosure:
 * - System prompt only gets skill name + description (~2% context budget)
 * - Full instructions are loaded on demand when a skill is invoked
 *
 * Matching uses:
 * - Explicit: /skill-name in user message
 * - Implicit: trigger.patterns, triggerSignals, whenToUse keywords
 * - Negative: avoidWhen signals suppress matching
 */
export class SkillManager {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    const snapshot = snapshotSkillDefinition(skill);
    this.skills.set(snapshot.name, snapshot);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  get(name: string): SkillDefinition | null {
    const skill = this.skills.get(name);
    return skill ? snapshotSkillDefinition(skill) : null;
  }

  list(): SkillDefinition[] {
    return snapshotSkillDefinitions(this.skills.values());
  }

  /**
   * Get lightweight summaries for system prompt injection.
   * Respects the context budget (~2% of context window).
   */
  getSummaries(maxChars: number = DEFAULT_MAX_SUMMARY_CHARS): string {
    const lines: string[] = [];
    let charCount = 0;

    for (const skill of this.skills.values()) {
      const line = `- ${skill.name}: ${skill.description}`;
      if (charCount + line.length > maxChars) break;
      lines.push(line);
      charCount += line.length;
    }

    if (lines.length === 0) return '';
    return `Available skills (invoke with /skill-name or by describing the task):\n${lines.join('\n')}`;
  }

  /**
   * Load full instructions for a skill (on demand).
   */
  loadInstructions(name: string): string | null {
    const skill = this.skills.get(name);
    return skill?.instructions ?? null;
  }

  /**
   * Find skills relevant to a user message using multi-signal matching.
   *
   * Matching signals (in priority order):
   * 1. Explicit /skill-name invocation
   * 2. triggerSignals keywords (high weight)
   * 3. trigger.patterns keywords
   * 4. whenToUse keywords (medium weight)
   *
   * Negative signals:
   * - avoidWhen: if ALL words in an avoidWhen entry appear in the message, skip this skill
   */
  findRelevant(message: string): SkillDefinition[] {
    const relevant = Array.from(this.skills.values()).filter((skill) =>
      matchesSkillRequest(skill, message),
    );
    return snapshotSkillDefinitions(relevant);
  }

  /**
   * Check if a skill's required tools are all available.
   */
  isSkillAvailable(skill: SkillDefinition, availableTools: string[]): boolean {
    if (!skill.requiredTools) return true;
    return skill.requiredTools.every((t) => availableTools.includes(t));
  }

  /**
   * Get the effective tool list when a skill is active.
   * Returns null if no tool restrictions apply.
   */
  getEffectiveTools(skill: SkillDefinition, allTools: string[]): string[] | null {
    if (!skill.allowedTools?.length && !skill.disallowedTools?.length) return null;

    let tools = allTools;
    if (skill.allowedTools?.length) {
      tools = tools.filter((t) => skill.allowedTools!.includes(t));
    }
    if (skill.disallowedTools?.length) {
      tools = tools.filter((t) => !skill.disallowedTools!.includes(t));
    }
    return tools;
  }

  clear(): void {
    this.skills.clear();
  }

  get size(): number {
    return this.skills.size;
  }
}
