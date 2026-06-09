import { describe, it, expect, beforeEach } from 'vitest';
import type { SkillDefinition } from '@svton/agent-core';
import { SkillManager, SkillLoader } from '@svton/agent-core';
import type { IStorage } from '@svton/agent-platform';

// ============================================================
// Mock Storage
// ============================================================

class MockStorage implements IStorage {
  private data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

// ============================================================
// SkillManager Tests
// ============================================================

describe('SkillManager', () => {
  let manager: SkillManager;

  const makeSkill = (overrides: Partial<SkillDefinition> = {}): SkillDefinition => ({
    name: 'test-skill',
    description: 'A test skill',
    instructions: 'Do the thing step by step.',
    scope: 'user',
    ...overrides,
  });

  beforeEach(() => {
    manager = new SkillManager();
  });

  it('register/get/unregister/list work', () => {
    const skill1 = makeSkill({ name: 'skill-a', description: 'First skill' });
    const skill2 = makeSkill({ name: 'skill-b', description: 'Second skill' });

    manager.register(skill1);
    manager.register(skill2);

    expect(manager.size).toBe(2);

    expect(manager.get('skill-a')).toEqual(skill1);
    expect(manager.get('skill-b')).toEqual(skill2);
    expect(manager.get('nonexistent')).toBeNull();

    const all = manager.list();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.name).sort()).toEqual(['skill-a', 'skill-b']);

    expect(manager.unregister('skill-a')).toBe(true);
    expect(manager.size).toBe(1);
    expect(manager.get('skill-a')).toBeNull();

    // Unregistering again returns false
    expect(manager.unregister('skill-a')).toBe(false);
  });

  it('clear removes all skills', () => {
    manager.register(makeSkill({ name: 'a' }));
    manager.register(makeSkill({ name: 'b' }));
    expect(manager.size).toBe(2);

    manager.clear();
    expect(manager.size).toBe(0);
    expect(manager.list()).toEqual([]);
  });

  it('getSummaries formats skills with budget limit', () => {
    manager.register(makeSkill({ name: 'alpha', description: 'Alpha skill' }));
    manager.register(makeSkill({ name: 'beta', description: 'Beta skill' }));

    const summary = manager.getSummaries();

    expect(summary).toContain('Available skills');
    expect(summary).toContain('- alpha: Alpha skill');
    expect(summary).toContain('- beta: Beta skill');
  });

  it('getSummaries respects maxChars budget', () => {
    // Register many skills with long descriptions
    for (let i = 0; i < 20; i++) {
      manager.register(
        makeSkill({
          name: `skill-${i}`,
          description: `Skill number ${i} with a description that is moderately long to test truncation.`,
        }),
      );
    }

    const smallBudget = 200;
    const summary = manager.getSummaries(smallBudget);

    // Summary should be within or near budget
    expect(summary.length).toBeLessThanOrEqual(smallBudget + 100); // allow header overhead
    expect(summary).toContain('Available skills');
  });

  it('getSummaries returns empty string when no skills', () => {
    expect(manager.getSummaries()).toBe('');
  });

  it('loadInstructions returns instructions for registered skill', () => {
    const skill = makeSkill({
      name: 'my-skill',
      instructions: '# Step 1\nDo something.\n# Step 2\nDo more.',
    });
    manager.register(skill);

    expect(manager.loadInstructions('my-skill')).toBe(
      '# Step 1\nDo something.\n# Step 2\nDo more.',
    );
    expect(manager.loadInstructions('nonexistent')).toBeNull();
  });

  it('findRelevant matches /skill-name pattern', () => {
    manager.register(
      makeSkill({ name: 'create-api', description: 'Create an API endpoint' }),
    );
    manager.register(
      makeSkill({ name: 'refactor', description: 'Refactor code' }),
    );

    const results = manager.findRelevant('Please /create-api for users');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('create-api');
  });

  it('findRelevant matches implicit trigger patterns', () => {
    manager.register(
      makeSkill({
        name: 'test-gen',
        description: 'Generate tests',
        trigger: { type: 'implicit', patterns: ['write tests', 'unit test'] },
      }),
    );
    manager.register(
      makeSkill({ name: 'deploy', description: 'Deploy code' }),
    );

    const results = manager.findRelevant('Can you write tests for this module?');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('test-gen');
  });

  it('findRelevant returns empty array when nothing matches', () => {
    manager.register(makeSkill({ name: 'a', description: 'Skill A' }));

    const results = manager.findRelevant('Something completely unrelated');
    expect(results).toHaveLength(0);
  });

  it('findRelevant can match multiple skills', () => {
    manager.register(
      makeSkill({ name: 'a', description: 'A' }),
    );
    manager.register(
      makeSkill({ name: 'b', description: 'B' }),
    );

    const results = manager.findRelevant('/a and /b please');
    expect(results).toHaveLength(2);
    expect(results.map((s) => s.name).sort()).toEqual(['a', 'b']);
  });

  it('isSkillAvailable returns true when no requiredTools', () => {
    const skill = makeSkill({ name: 'x' });
    expect(manager.isSkillAvailable(skill, [])).toBe(true);
  });

  it('isSkillAvailable checks requiredTools against available tools', () => {
    const skill = makeSkill({
      name: 'shell-skill',
      requiredTools: ['bash', 'file_read'],
    });

    expect(manager.isSkillAvailable(skill, ['bash'])).toBe(false);
    expect(manager.isSkillAvailable(skill, ['bash', 'file_read'])).toBe(true);
    expect(manager.isSkillAvailable(skill, ['bash', 'file_read', 'extra'])).toBe(true);
  });
});

// ============================================================
// SkillLoader Tests
// ============================================================

describe('SkillLoader', () => {
  it('parseMarkdown with frontmatter: extracts name, description, scope, trigger, instructions', () => {
    const markdown = `---
name: create-api-endpoint
description: Create a new REST API endpoint
scope: repo
trigger: explicit
requiredTools: bash, file_write
---

# Create API Endpoint

## Steps
1. Define the route
2. Implement the handler
3. Add validation`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.name).toBe('create-api-endpoint');
    expect(skill.description).toBe('Create a new REST API endpoint');
    expect(skill.scope).toBe('repo');
    expect(skill.trigger).toEqual({ type: 'explicit' });
    expect(skill.requiredTools).toEqual(['bash', 'file_write']);
    expect(skill.instructions).toContain('# Create API Endpoint');
    expect(skill.instructions).toContain('Implement the handler');
  });

  it('parseMarkdown without frontmatter: entire content as instructions', () => {
    const markdown = `# My Custom Skill

Just do the thing.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.name).toBe('unnamed-skill');
    expect(skill.description).toBe('Custom skill');
    expect(skill.scope).toBe('user');
    expect(skill.instructions).toBe('# My Custom Skill\n\nJust do the thing.');
    expect(skill.trigger).toBeUndefined();
  });

  it('parseMarkdown with missing fields uses defaults', () => {
    const markdown = `---
name: minimal-skill
---

Some instructions here.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.name).toBe('minimal-skill');
    expect(skill.description).toBe('');
    expect(skill.scope).toBe('user');
    expect(skill.trigger).toBeUndefined();
    expect(skill.requiredTools).toBeUndefined();
  });

  it('fromStorage loads from storage with agent:skill: prefix', async () => {
    const storage = new MockStorage();

    const skillA: SkillDefinition = {
      name: 'stored-a',
      description: 'Stored skill A',
      instructions: 'Do A',
      scope: 'user',
    };
    const skillB: SkillDefinition = {
      name: 'stored-b',
      description: 'Stored skill B',
      instructions: 'Do B',
      scope: 'repo',
    };

    await storage.set('agent:skill:stored-a', skillA);
    await storage.set('agent:skill:stored-b', skillB);
    // Add a non-skill key to ensure it's filtered
    await storage.set('other:key', 'value');

    const skills = await SkillLoader.fromStorage(storage);

    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(['stored-a', 'stored-b']);
  });

  it('fromStorage returns empty array when no skills stored', async () => {
    const storage = new MockStorage();
    const skills = await SkillLoader.fromStorage(storage);
    expect(skills).toEqual([]);
  });

  it('saveToStorage saves with correct key', async () => {
    const storage = new MockStorage();

    const skill: SkillDefinition = {
      name: 'my-skill',
      description: 'My skill',
      instructions: 'Instructions',
      scope: 'user',
    };

    await SkillLoader.saveToStorage(storage, skill);

    const stored = await storage.get<SkillDefinition>('agent:skill:my-skill');
    expect(stored).toEqual(skill);
  });

  it('removeFromStorage deletes the correct key', async () => {
    const storage = new MockStorage();

    const skill: SkillDefinition = {
      name: 'remove-me',
      description: 'To be removed',
      instructions: 'N/A',
      scope: 'user',
    };

    await storage.set('agent:skill:remove-me', skill);
    expect(await storage.get('agent:skill:remove-me')).not.toBeNull();

    await SkillLoader.removeFromStorage(storage, 'remove-me');
    expect(await storage.get('agent:skill:remove-me')).toBeNull();
  });
});
