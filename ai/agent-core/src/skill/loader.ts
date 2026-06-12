import type { SkillDefinition } from './types';
import type { IStorage, IPlatform } from '@svton/agent-platform';

const SKILL_STORAGE_PREFIX = 'agent:skill:';
const INSTALLED_STORAGE_PREFIX = 'agent:skill-installed:';
const REGISTRY_STORAGE_PREFIX = 'agent:skill-registry:';

// ── YAML Frontmatter Parser ─────────────────────────────

/**
 * Parse YAML-like frontmatter supporting:
 * - key: value          (string)
 * - key: [a, b, c]      (bracket array)
 * - key: a, b, c        (comma-separated array)
 * - key:                 (YAML list follows)
 *   - item1
 *   - item2
 *
 * Array-valued keys are detected by convention:
 * requiredTools, requiredCapabilities, allowedTools, disallowedTools,
 * whenToUse, avoidWhen, triggerSignals, patterns, trigger-signals,
 * allowed-tools, disallowed-tools, when-to-use, avoid-when
 */
const ARRAY_KEYS = new Set([
  'requiredTools', 'requiredCapabilities', 'allowedTools', 'disallowedTools',
  'whenToUse', 'avoidWhen', 'triggerSignals', 'patterns',
  'required-tools', 'required-capabilities', 'allowed-tools', 'disallowed-tools',
  'when-to-use', 'avoid-when', 'trigger-signals',
]);

function normalizeKey(key: string): string {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArrayValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  // Bracket notation: [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
  }
  // Comma-separated
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  // Single value
  return [trimmed];
}

function parseFrontmatter(text: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = text.split('\n');
  let currentKey = '';

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    // Indented list item: "  - value"
    const listMatch = line.match(/^(\s+)-\s+(.+)$/);
    if (listMatch && currentKey) {
      const nk = normalizeKey(currentKey);
      if (ARRAY_KEYS.has(nk)) {
        const existing = result[nk];
        const item = listMatch[2].trim();
        if (Array.isArray(existing)) existing.push(item);
        else result[nk] = [item];
      }
      continue;
    }

    // Top-level key: value
    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kvMatch) {
      const rawKey = kvMatch[1];
      const rawValue = kvMatch[2].trim();
      const nk = normalizeKey(rawKey);
      currentKey = rawKey;

      if (ARRAY_KEYS.has(nk)) {
        result[nk] = rawValue ? parseArrayValue(rawValue) : [];
      } else {
        // Strip surrounding quotes
        result[nk] = rawValue.replace(/^["'](.*)["']$/, '$1');
      }
    }
  }

  return result;
}

// ── SkillLoader ──────────────────────────────────────────

/**
 * Loads skills from various sources with multi-scope discovery.
 */
export class SkillLoader {
  // ── Markdown Parsing ──

  /**
   * Parse a SKILL.md file into a SkillDefinition.
   * Supports Agent Skills Open Standard frontmatter with extensions.
   */
  static parseMarkdown(content: string): SkillDefinition {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!fmMatch) {
      return {
        name: 'unnamed-skill',
        description: '',
        instructions: content.trim(),
        scope: 'user',
      };
    }

    const meta = parseFrontmatter(fmMatch[1]);
    const body = fmMatch[2].trim();

    // Build trigger from parsed data
    let trigger: SkillDefinition['trigger'];
    const triggerType = meta.trigger as string | undefined;
    const patterns = meta.patterns as string[] | undefined;
    if (triggerType || patterns) {
      trigger = {
        type: (triggerType === 'implicit' ? 'implicit' : 'explicit'),
        patterns,
      };
    }

    return {
      name: (meta.name as string) || 'unnamed-skill',
      description: (meta.description as string) || '',
      instructions: body,
      scope: (meta.scope as SkillDefinition['scope']) || 'user',
      trigger,
      requiredTools: meta.requiredTools as string[] | undefined,
      requiredCapabilities: meta.requiredCapabilities as string[] | undefined,
      allowedTools: meta.allowedTools as string[] | undefined,
      disallowedTools: meta.disallowedTools as string[] | undefined,
      whenToUse: meta.whenToUse as string[] | undefined,
      avoidWhen: meta.avoidWhen as string[] | undefined,
      triggerSignals: meta.triggerSignals as string[] | undefined,
      version: (meta.version as string) || undefined,
    };
  }

  // ── IStorage Persistence ──

  /** Load all user-created skills from IStorage. */
  static async fromStorage(storage: IStorage): Promise<SkillDefinition[]> {
    const keys = await storage.list(SKILL_STORAGE_PREFIX);
    const skills: SkillDefinition[] = [];
    for (const key of keys) {
      const skill = await storage.get<SkillDefinition>(key);
      if (skill) skills.push(skill);
    }
    return skills;
  }

  /** Save a user-created skill to IStorage. */
  static async saveToStorage(storage: IStorage, skill: SkillDefinition): Promise<void> {
    await storage.set(`${SKILL_STORAGE_PREFIX}${skill.name}`, skill);
  }

  /** Remove a user-created skill from IStorage. */
  static async removeFromStorage(storage: IStorage, name: string): Promise<void> {
    await storage.delete(`${SKILL_STORAGE_PREFIX}${name}`);
  }

  // ── Installed Skills Persistence ──

  /** Load all externally-installed skills from IStorage. */
  static async fromInstalled(storage: IStorage): Promise<SkillDefinition[]> {
    const keys = await storage.list(INSTALLED_STORAGE_PREFIX);
    const skills: SkillDefinition[] = [];
    for (const key of keys) {
      const skill = await storage.get<SkillDefinition>(key);
      if (skill) skills.push(skill);
    }
    return skills;
  }

  /** Save an installed skill to IStorage. */
  static async saveInstalled(storage: IStorage, skill: SkillDefinition): Promise<void> {
    await storage.set(`${INSTALLED_STORAGE_PREFIX}${skill.name}`, skill);
  }

  /** Remove an installed skill from IStorage. */
  static async removeInstalled(storage: IStorage, name: string): Promise<void> {
    await storage.delete(`${INSTALLED_STORAGE_PREFIX}${name}`);
  }

  // ── Multi-Scope Discovery ──

  /**
   * Discover skills from all scopes with priority-based merging.
   *
   * Priority (low to high, higher overwrites same-name):
   * 1. System - built-in skills from HTTP fetch (builtinPaths)
   * 2. Project - from workingDir/.svton/skills/ subdirectories (desktop only)
   * 3. User - user-created skills from IStorage
   * 4. Installed - externally installed skills from IStorage
   */
  static async discover(
    storage: IStorage,
    platform: IPlatform,
    builtinPaths: string[],
    workingDir?: string,
  ): Promise<{ skills: SkillDefinition[]; errors: string[] }> {
    const map = new Map<string, SkillDefinition>();
    const errors: string[] = [];
    const cwd = workingDir || platform.process.getCwd() || '/';

    // 1. System - built-in skills
    for (const url of builtinPaths) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const content = await resp.text();
          const skill = this.parseMarkdown(content);
          skill.source = { type: 'builtin' };
          map.set(skill.name, skill);
        }
      } catch {
        // Skip skills that fail to load
      }
    }

    // 2. Project - from .svton/skills/ directory (desktop only)
    if (platform.capabilities.filesystem) {
      try {
        const skillsDir = platform.fs.resolve(`${cwd}/.svton/skills`);
        const exists = await platform.fs.exists(skillsDir);
        if (exists) {
          const entries = await platform.fs.listDir(skillsDir);
          for (const entry of entries) {
            if (entry.isDirectory) {
              try {
                const content = await platform.fs.readFile(
                  platform.fs.join(skillsDir, entry.name, 'SKILL.md'),
                );
                const skill = this.parseMarkdown(content);
                skill.scope = 'project';
                skill.source = skill.source || { type: 'local', path: skillsDir };
                map.set(skill.name, skill);
              } catch {
                // SKILL.md not found in this subdirectory
              }
            }
          }
        }
      } catch {
        // .svton/skills/ directory doesn't exist — that's fine
      }
    }

    // 3. User — user-created skills from storage
    try {
      const userSkills = await this.fromStorage(storage);
      for (const skill of userSkills) {
        skill.source = skill.source || { type: 'storage' };
        map.set(skill.name, skill);
      }
    } catch {
      // Storage read failed — skip
    }

    // 4. Installed — externally installed skills
    try {
      const installedSkills = await this.fromInstalled(storage);
      for (const skill of installedSkills) {
        map.set(skill.name, skill);
      }
    } catch {
      // Installed read failed — skip
    }

    return { skills: Array.from(map.values()), errors };
  }
}
