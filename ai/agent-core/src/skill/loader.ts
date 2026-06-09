import type { SkillDefinition } from './types';
import type { IStorage } from '@svton/agent-platform';

const SKILL_STORAGE_PREFIX = 'agent:skill:';

/**
 * Loads skills from various sources.
 */
export class SkillLoader {
  /**
   * Load skills from an IStorage backend.
   * Skills are stored as JSON keyed by `agent:skill:<name>`.
   */
  static async fromStorage(storage: IStorage): Promise<SkillDefinition[]> {
    const keys = await storage.list(SKILL_STORAGE_PREFIX);
    const skills: SkillDefinition[] = [];

    for (const key of keys) {
      const skill = await storage.get<SkillDefinition>(key);
      if (skill) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * Load a single skill to storage.
   */
  static async saveToStorage(
    storage: IStorage,
    skill: SkillDefinition,
  ): Promise<void> {
    await storage.set(`${SKILL_STORAGE_PREFIX}${skill.name}`, skill);
  }

  /**
   * Remove a skill from storage.
   */
  static async removeFromStorage(
    storage: IStorage,
    name: string,
  ): Promise<void> {
    await storage.delete(`${SKILL_STORAGE_PREFIX}${name}`);
  }

  /**
   * Parse a SKILL.md file into a SkillDefinition.
   *
   * Expected format:
   * ```
   * ---
   * name: my-skill
   * description: One line description
   * scope: user
   * trigger: explicit
   * ---
   *
   * Full skill instructions in Markdown...
   * ```
   */
  static parseMarkdown(content: string): SkillDefinition {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      // No frontmatter - use entire content as instructions
      return {
        name: 'unnamed-skill',
        description: 'Custom skill',
        instructions: content.trim(),
        scope: 'user',
      };
    }

    const [, frontmatter, body] = frontmatterMatch;
    const meta: Record<string, string> = {};

    for (const line of frontmatter.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        meta[key] = value;
      }
    }

    return {
      name: meta.name || 'unnamed-skill',
      description: meta.description || '',
      instructions: body.trim(),
      scope: (meta.scope as SkillDefinition['scope']) || 'user',
      trigger: meta.trigger
        ? { type: meta.trigger as 'explicit' | 'implicit' }
        : undefined,
      requiredTools: meta.requiredTools
        ? meta.requiredTools.split(',').map((s) => s.trim())
        : undefined,
    };
  }
}
