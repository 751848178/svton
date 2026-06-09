import type { SkillDefinition, SkillSummary } from './types';

const CONTEXT_BUDGET_RATIO = 0.02; // ~2% of context for skill summaries
const DEFAULT_MAX_SUMMARY_CHARS = 8000;

/**
 * Manages skill definitions with progressive disclosure.
 *
 * Progressive disclosure:
 * - System prompt only gets skill name + description (~2% context budget)
 * - Full instructions are loaded on demand when a skill is invoked
 */
export class SkillManager {
  private skills = new Map<string, SkillDefinition>();

  /**
   * Register a skill.
   */
  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * Unregister a skill.
   */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /**
   * Get a skill by name.
   */
  get(name: string): SkillDefinition | null {
    return this.skills.get(name) ?? null;
  }

  /**
   * Get all registered skills.
   */
  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get lightweight summaries for system prompt injection.
   * Respects the context budget (~2% of context window).
   *
   * Returns a formatted string ready to inject into the system prompt.
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
   * Returns null if skill not found.
   */
  loadInstructions(name: string): string | null {
    const skill = this.skills.get(name);
    return skill?.instructions ?? null;
  }

  /**
   * Find skills that might be relevant to a user message.
   * Simple keyword matching against trigger patterns and descriptions.
   */
  findRelevant(message: string): SkillDefinition[] {
    const lower = message.toLowerCase();
    const relevant: SkillDefinition[] = [];

    for (const skill of this.skills.values()) {
      // Check explicit invocation: /skill-name
      if (lower.includes(`/${skill.name}`)) {
        relevant.push(skill);
        continue;
      }

      // Check trigger patterns
      if (skill.trigger?.type === 'implicit' && skill.trigger.patterns) {
        for (const pattern of skill.trigger.patterns) {
          if (lower.includes(pattern.toLowerCase())) {
            relevant.push(skill);
            break;
          }
        }
      }
    }

    return relevant;
  }

  /**
   * Check if a skill's required tools are all available.
   */
  isSkillAvailable(
    skill: SkillDefinition,
    availableTools: string[],
  ): boolean {
    if (!skill.requiredTools) return true;
    return skill.requiredTools.every((t) => availableTools.includes(t));
  }

  /**
   * Clear all skills.
   */
  clear(): void {
    this.skills.clear();
  }

  /**
   * Get the number of registered skills.
   */
  get size(): number {
    return this.skills.size;
  }
}
