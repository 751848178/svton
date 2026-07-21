import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SkillDefinition } from '@svton/agent-core';
import { SkillManager, SkillLoader, SkillInstaller } from '@svton/agent-core';
import type { IStorage, IPlatform } from '@svton/agent-platform';

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
// Mock Platform Helper
// ============================================================

interface MockFsOverrides {
  exists?: (path: string) => Promise<boolean>;
  listDir?: () => Promise<Array<{ name: string; path: string; isFile: boolean; isDirectory: boolean }>>;
  readFile?: (path: string) => Promise<string>;
}

function createMockPlatform(
  overrides: {
    fs?: MockFsOverrides;
    exec?: (command: string, options?: unknown) => Promise<any>;
  } = {},
): IPlatform {
  const defaultFs = {
    exists: async () => false,
    listDir: async () => [],
    readFile: async () => '',
    writeFile: async () => {},
    editFile: async () => false,
    deleteFile: async () => {},
    stat: async () => ({ isFile: false, isDirectory: false, size: 0, modifiedAt: 0, createdAt: 0 }),
    watch: () => ({ close() {} }),
    join: (...paths: string[]) => paths.join('/'),
    resolve: (p: string) => p,
    relative: () => '',
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
    basename: (p: string) => p.split('/').pop() || '',
  };

  return {
    type: 'electron',
    capabilities: {
      filesystem: true,
      process: true,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
      sandboxing: false,
      pty: false,
    },
    fs: { ...defaultFs, ...overrides.fs },
    process: {
      exec: overrides.exec ?? (async () => ({ stdout: '', stderr: '', exitCode: 0, timedOut: false })),
      spawn: () => ({
        pid: null,
        onStdout: () => {},
        onStderr: () => {},
        onExit: () => {},
        kill: () => {},
        write: async () => {},
      }),
      getEnv: () => undefined,
      getCwd: () => '/test',
    },
    storage: new MockStorage(),
    search: {
      grep: async () => [],
      glob: async () => [],
    },
  };
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

  it('protects registered skill definitions from caller and result mutation', () => {
    const skill = makeSkill({
      name: 'review-skill',
      description: 'Review code',
      instructions: 'Review carefully',
      trigger: { type: 'implicit', patterns: ['review code'] },
      requiredTools: ['git_diff'],
      requiredCapabilities: ['sandboxing'],
      allowedTools: ['git_diff', 'file_read'],
      disallowedTools: ['bash'],
      whenToUse: ['code review'],
      avoidWhen: ['write docs'],
      triggerSignals: ['review code'],
      version: '1.0.0',
      source: { type: 'git', repo: 'https://example.test/review.git', ref: 'main' },
    });

    manager.register(skill);
    skill.description = 'Injected description';
    skill.trigger!.patterns!.push('mutated registration');
    skill.allowedTools!.push('bash');
    (skill.source as { type: 'git'; repo: string; ref?: string }).repo = 'https://evil.test/review.git';

    const fromGet = manager.get('review-skill')!;
    expect(fromGet.description).toBe('Review code');
    expect(fromGet.trigger?.patterns).toEqual(['review code']);
    expect(fromGet.allowedTools).toEqual(['git_diff', 'file_read']);
    expect(fromGet.source).toEqual({
      type: 'git',
      repo: 'https://example.test/review.git',
      ref: 'main',
    });

    fromGet.trigger!.patterns!.push('mutated get');
    fromGet.requiredTools!.push('missing_tool');
    const fromList = manager.list().find((s) => s.name === 'review-skill')!;
    fromList.triggerSignals!.push('mutated list');
    fromList.disallowedTools!.push('sudo');

    const firstRelevant = manager.findRelevant('please review code')[0];
    firstRelevant.whenToUse!.push('mutated relevant');

    const fresh = manager.get('review-skill')!;
    expect(fresh.requiredTools).toEqual(['git_diff']);
    expect(fresh.disallowedTools).toEqual(['bash']);
    expect(fresh.triggerSignals).toEqual(['review code']);
    expect(fresh.whenToUse).toEqual(['code review']);
    expect(manager.isSkillAvailable(manager.findRelevant('please review code')[0], ['git_diff'])).toBe(true);
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

  // ── CJK matching (the matcher must not require English keywords) ──

  it('findRelevant matches short CJK trigger signals (>=2 chars)', () => {
    manager.register(
      makeSkill({
        name: 'nav',
        description: 'navigate code graph',
        triggerSignals: ['调用 调用方 影响面 caller callee'],
      }),
    );

    // 2-char CJK words like 调用 / 影响面 must survive tokenization
    const hit = manager.findRelevant('这个函数在哪里被调用？');
    expect(hit).toHaveLength(1);
    expect(hit[0].name).toBe('nav');
  });

  it('findRelevant matches a 3-char Latin keyword embedded in CJK punctuation', () => {
    manager.register(
      makeSkill({
        name: 'verify',
        description: 'verify before done',
        triggerSignals: ['验证 测试 bug、修复 done'],
      }),
    );

    // "bug" (3 chars) is now kept, and 、 no longer glues it to the next token
    const hit = manager.findRelevant('帮我修一下登录的 bug');
    expect(hit).toHaveLength(1);
    expect(hit[0].name).toBe('verify');
  });

  it('findRelevant does not over-trigger on common filler words', () => {
    manager.register(
      makeSkill({
        name: 'lonely',
        description: 'a skill',
        triggerSignals: ['the for and of'], // all <=3 Latin -> dropped, no tokens
      }),
    );

    const results = manager.findRelevant('the quick brown fox jumps over the lazy dog');
    expect(results.map((s) => s.name)).not.toContain('lonely');
  });

  // Regression: code-review skill must not fire on ordinary Chinese requests
  // that happen to contain the bare word "审查" (e.g. "帮我审查一下这个配置").
  // CJK tokens match by substring, so trigger signals must use full phrases
  // ("审查代码" / "代码审查"), not the bare 2-char word. Otherwise the skill's
  // allowedTools whitelist blocks bash/file_write and every other general tool.
  it('findRelevant does not fire code-review on bare "审查" substring', () => {
    manager.register(
      makeSkill({
        name: 'code-review',
        description: 'Code review',
        triggerSignals: ['/review', 'code review', 'review code', '审查代码', '代码审查'],
        trigger: { type: 'implicit', patterns: ['/review', 'review code', 'code review', '审查代码', '代码审查'] },
        allowedTools: ['git_diff', 'file_read'],
      }),
    );

    // Ordinary Chinese requests containing 审查 but NOT 审查代码/代码审查
    const miss1 = manager.findRelevant('帮我审查一下这个配置文件');
    const miss2 = manager.findRelevant('这个方案需要再审查审查');
    expect(miss1.map((s) => s.name)).not.toContain('code-review');
    expect(miss2.map((s) => s.name)).not.toContain('code-review');

    // Genuine review requests must still match
    const hit1 = manager.findRelevant('请帮我做代码审查');
    const hit2 = manager.findRelevant('帮我审查代码');
    expect(hit1.map((s) => s.name)).toContain('code-review');
    expect(hit2.map((s) => s.name)).toContain('code-review');
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
    expect(skill.description).toBe('');
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

  it('parseMarkdown extracts matching metadata from standard body sections', () => {
    const markdown = `---
name: body-section-skill
description: Standard frontmatter with body sections
---

# Body Section Skill

## Use When

- React TSX component refactor
- 拆分复杂页面和弹窗

## Avoid When

- Backend service work

## Trigger Signals

- useState useEffect variant mode
- fallback retry in view

## Rules

- Keep the body intact.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.whenToUse).toEqual([
      'React TSX component refactor',
      '拆分复杂页面和弹窗',
    ]);
    expect(skill.avoidWhen).toEqual(['Backend service work']);
    expect(skill.triggerSignals).toEqual([
      'useState useEffect variant mode',
      'fallback retry in view',
    ]);
    expect(skill.instructions).toContain('## Trigger Signals');
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

  it('parseMarkdown with YAML-list style array values (indented - item lines)', () => {
    const markdown = `---
name: list-style-skill
description: Uses YAML list style
requiredTools:
  - bash
  - file_read
  - file_write
---

Do stuff.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.name).toBe('list-style-skill');
    expect(skill.requiredTools).toEqual(['bash', 'file_read', 'file_write']);
  });

  it('parseMarkdown with bracket-array values', () => {
    const markdown = `---
name: bracket-skill
description: Bracket arrays
requiredTools: [bash, file_read, file_write]
---

Do stuff.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.name).toBe('bracket-skill');
    expect(skill.requiredTools).toEqual(['bash', 'file_read', 'file_write']);
  });

  it('parseMarkdown with trigger patterns builds trigger object', () => {
    const markdown = `---
name: triggered-skill
description: Has trigger
trigger: implicit
patterns:
  - write tests
  - unit test
  - test coverage
---

Do stuff.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.trigger).toEqual({
      type: 'implicit',
      patterns: ['write tests', 'unit test', 'test coverage'],
    });
  });

  it('parseMarkdown with explicit trigger and no patterns', () => {
    const markdown = `---
name: explicit-trigger-skill
description: Explicit trigger
trigger: explicit
---

Do stuff.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.trigger).toEqual({ type: 'explicit' });
  });

  it('parseMarkdown with implicit trigger type', () => {
    const markdown = `---
name: implicit-skill
description: Implicit trigger
trigger: implicit
---

Auto-triggered.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.trigger).toEqual({ type: 'implicit' });
  });

  it('parseMarkdown with all optional fields', () => {
    const markdown = `---
name: full-skill
description: All fields
version: "1.2.0"
requiredTools: bash, git
allowedTools: bash, git, editor
disallowedTools: rm, sudo
whenToUse:
  - when you need to deploy
  - when releasing
avoidWhen:
  - during development
  - on local machine
triggerSignals:
  - deploy
  - release
---

Full skill instructions.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.version).toBe('1.2.0');
    expect(skill.requiredTools).toEqual(['bash', 'git']);
    expect(skill.allowedTools).toEqual(['bash', 'git', 'editor']);
    expect(skill.disallowedTools).toEqual(['rm', 'sudo']);
    expect(skill.whenToUse).toEqual(['when you need to deploy', 'when releasing']);
    expect(skill.avoidWhen).toEqual(['during development', 'on local machine']);
    expect(skill.triggerSignals).toEqual(['deploy', 'release']);
  });

  it('parseMarkdown with kebab-case keys normalizes to camelCase', () => {
    const markdown = `---
name: kebab-skill
description: Kebab keys
required-tools: bash, git
allowed-tools: editor
disallowed-tools: rm
when-to-use:
  - deploying
avoid-when:
  - local dev
trigger-signals:
  - deploy
---

Kebab skill.`;

    const skill = SkillLoader.parseMarkdown(markdown);

    expect(skill.requiredTools).toEqual(['bash', 'git']);
    expect(skill.allowedTools).toEqual(['editor']);
    expect(skill.disallowedTools).toEqual(['rm']);
    expect(skill.whenToUse).toEqual(['deploying']);
    expect(skill.avoidWhen).toEqual(['local dev']);
    expect(skill.triggerSignals).toEqual(['deploy']);
  });

  it('fromInstalled / saveInstalled / removeInstalled storage operations', async () => {
    const storage = new MockStorage();

    const skillA: SkillDefinition = {
      name: 'installed-a',
      description: 'Installed A',
      instructions: 'Do A',
      scope: 'user',
    };
    const skillB: SkillDefinition = {
      name: 'installed-b',
      description: 'Installed B',
      instructions: 'Do B',
      scope: 'user',
    };

    // Save
    await SkillLoader.saveInstalled(storage, skillA);
    await SkillLoader.saveInstalled(storage, skillB);

    // Verify keys
    const keys = await storage.list('agent:skill-installed:');
    expect(keys.sort()).toEqual([
      'agent:skill-installed:installed-a',
      'agent:skill-installed:installed-b',
    ]);

    // Load all
    const skills = await SkillLoader.fromInstalled(storage);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(['installed-a', 'installed-b']);

    // Remove one
    await SkillLoader.removeInstalled(storage, 'installed-a');
    const remaining = await SkillLoader.fromInstalled(storage);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('installed-b');

    // Check raw key gone
    expect(await storage.get('agent:skill-installed:installed-a')).toBeNull();
  });

  it('discover returns skills from builtin URLs (mock fetch)', async () => {
    const storage = new MockStorage();
    const platform = createMockPlatform();

    // Mock fetch to return a SKILL.md
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `---\nname: builtin-skill\ndescription: Built-in\nscope: user\n---\n\nBuilt-in instructions.`,
    }) as any;

    const { skills, errors } = await SkillLoader.discover(
      storage,
      platform,
      ['https://example.com/skills/builtin/SKILL.md'],
    );

    globalThis.fetch = originalFetch;

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('builtin-skill');
    expect(skills[0].source).toEqual({ type: 'builtin' });
    expect(errors).toEqual([]);
  });

  it('discover returns skills from project dir (mock platform.fs)', async () => {
    const storage = new MockStorage();
    const platform = createMockPlatform({
      fs: {
        exists: async (path: string) => path.includes('.svton/skills'),
        listDir: async () => [
          { name: 'my-project-skill', path: '', isFile: false, isDirectory: true },
        ],
        readFile: async () =>
          '---\nname: project-skill\ndescription: Project skill\n---\n\nProject instructions.',
      },
    });

    const { skills, errors } = await SkillLoader.discover(
      storage,
      platform,
      [],
      '/project',
    );

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('project-skill');
    expect(skills[0].scope).toBe('project');
    expect(errors).toEqual([]);
  });

  it('discover returns user skills from storage', async () => {
    const storage = new MockStorage();
    const platform = createMockPlatform();

    const userSkill: SkillDefinition = {
      name: 'user-skill',
      description: 'User-created',
      instructions: 'Do user stuff',
      scope: 'user',
    };
    await storage.set('agent:skill:user-skill', userSkill);

    const { skills } = await SkillLoader.discover(storage, platform, []);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('user-skill');
    expect(skills[0].source).toEqual({ type: 'storage' });
  });

  it('discover priority merging (installed overrides user)', async () => {
    const storage = new MockStorage();
    const platform = createMockPlatform();

    // User version
    const userSkill: SkillDefinition = {
      name: 'shared-name',
      description: 'User version',
      instructions: 'User instructions',
      scope: 'user',
    };
    await storage.set('agent:skill:shared-name', userSkill);

    // Installed version (same name, should override)
    const installedSkill: SkillDefinition = {
      name: 'shared-name',
      description: 'Installed version',
      instructions: 'Installed instructions',
      scope: 'user',
    };
    await storage.set('agent:skill-installed:shared-name', installedSkill);

    const { skills } = await SkillLoader.discover(storage, platform, []);

    expect(skills).toHaveLength(1);
    expect(skills[0].description).toBe('Installed version');
  });
});

// ============================================================
// SkillInstaller Tests
// ============================================================

describe('SkillInstaller', () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it('installFromUrl success', async () => {
    const installer = new SkillInstaller(storage);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `---\nname: url-skill\ndescription: From URL\n---\n\nURL instructions.`,
    }) as any;

    const result = await installer.installFromUrl('https://example.com/SKILL.md');

    globalThis.fetch = originalFetch;

    expect(result.success).toBe(true);
    expect(result.skill?.name).toBe('url-skill');
    expect(result.skill?.source).toEqual({ type: 'url', url: 'https://example.com/SKILL.md' });

    // Verify saved to installed storage
    const saved = await storage.get<SkillDefinition>('agent:skill-installed:url-skill');
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe('url-skill');

    // Verify registry record
    const record = await storage.get<any>('agent:skill-registry:url-skill');
    expect(record).not.toBeNull();
    expect(record.source.type).toBe('url');
  });

  it('installFromUrl HTTP error returns failure', async () => {
    const installer = new SkillInstaller(storage);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }) as any;

    const result = await installer.installFromUrl('https://example.com/missing.md');

    globalThis.fetch = originalFetch;

    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 404: Not Found');
  });

  it('installFromUrl fetch throws returns failure', async () => {
    const installer = new SkillInstaller(storage);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const result = await installer.installFromUrl('https://example.com/SKILL.md');

    globalThis.fetch = originalFetch;

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('installFromUrl SKILL.md without name returns failure', async () => {
    const installer = new SkillInstaller(storage);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# No Name Skill\n\nJust instructions, no frontmatter.',
    }) as any;

    const result = await installer.installFromUrl('https://example.com/SKILL.md');

    globalThis.fetch = originalFetch;

    expect(result.success).toBe(false);
    expect(result.error).toBe('SKILL.md missing required "name" field');
  });

  it('installFromGit no platform.process returns failure', async () => {
    const installer = new SkillInstaller(storage, undefined);

    const result = await installer.installFromGit('https://github.com/example/repo.git');

    expect(result.success).toBe(false);
    expect(result.error).toContain('desktop');
  });

  it('installFromGit quotes archive repo and ref arguments before shell execution', async () => {
    const exec = vi.fn(async () => ({
      stdout: '---\nname: git-skill\ndescription: Git\n---\n\nInstructions.',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    }));
    const installer = new SkillInstaller(storage, createMockPlatform({ exec }));

    const result = await installer.installFromGit(
      "https://example.com/repo.git; touch /tmp/pwned #",
      "main'; whoami #",
    );

    expect(result.success).toBe(true);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0][0]).toBe(
      "git archive --remote='https://example.com/repo.git; touch /tmp/pwned #' " +
        "'main'\\''; whoami #' SKILL.md 2>/dev/null | tar -xO",
    );
  });

  it('installFromGit fallback quotes clone repo and ref arguments before shell execution', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1, timedOut: false })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1, timedOut: false })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, timedOut: false });
    const installer = new SkillInstaller(storage, createMockPlatform({ exec }));

    const result = await installer.installFromGit(
      "https://example.com/repo.git; touch /tmp/pwned #",
      "main'; whoami #",
    );

    expect(result.success).toBe(false);
    expect(exec).toHaveBeenCalledTimes(3);
    expect(exec.mock.calls[1][0]).toMatch(
      /^git clone --depth 1 --branch 'main'\\''; whoami #' 'https:\/\/example\.com\/repo\.git; touch \/tmp\/pwned #' \/tmp\/svton-skill-\d+$/,
    );
    expect(exec.mock.calls[2][0]).toMatch(/^rm -rf \/tmp\/svton-skill-\d+$/);
  });

  it('installFromLocalDir no platform.fs returns failure', async () => {
    const installer = new SkillInstaller(storage, undefined);

    const result = await installer.installFromLocalDir('/some/dir');

    expect(result.success).toBe(false);
    expect(result.error).toContain('desktop');
  });

  it('installFromLocalDir success', async () => {
    const platform = createMockPlatform({
      fs: {
        exists: async () => true,
        readFile: async () =>
          '---\nname: local-skill\ndescription: Local\n---\n\nLocal instructions.',
      },
    });

    const installer = new SkillInstaller(storage, platform);
    const result = await installer.installFromLocalDir('/path/to/skill');

    expect(result.success).toBe(true);
    expect(result.skill?.name).toBe('local-skill');
    expect(result.skill?.source).toEqual({ type: 'local', path: '/path/to/skill' });
  });

  it('installFromLocalDir SKILL.md not found returns failure', async () => {
    const platform = createMockPlatform({
      fs: {
        exists: async () => false,
      },
    });

    const installer = new SkillInstaller(storage, platform);
    const result = await installer.installFromLocalDir('/path/to/skill');

    expect(result.success).toBe(false);
    expect(result.error).toContain('SKILL.md not found');
  });

  it('uninstall removes from both installed and registry storage', async () => {
    const installer = new SkillInstaller(storage);

    // Manually set up installed skill and registry record
    const skill: SkillDefinition = {
      name: 'to-uninstall',
      description: 'Will be removed',
      instructions: 'N/A',
      scope: 'user',
    };
    await storage.set('agent:skill-installed:to-uninstall', skill);
    await storage.set('agent:skill-registry:to-uninstall', {
      name: 'to-uninstall',
      source: { type: 'url', url: 'https://example.com' },
      installedAt: Date.now(),
    });

    // Confirm they exist
    expect(await storage.get('agent:skill-installed:to-uninstall')).not.toBeNull();
    expect(await storage.get('agent:skill-registry:to-uninstall')).not.toBeNull();

    await installer.uninstall('to-uninstall');

    // Confirm both removed
    expect(await storage.get('agent:skill-installed:to-uninstall')).toBeNull();
    expect(await storage.get('agent:skill-registry:to-uninstall')).toBeNull();
  });

  it('listInstalled returns records from storage', async () => {
    const installer = new SkillInstaller(storage);

    await storage.set('agent:skill-registry:skill-x', {
      name: 'skill-x',
      source: { type: 'url', url: 'https://example.com/x.md' },
      installedAt: 1000,
      version: '1.0.0',
    });
    await storage.set('agent:skill-registry:skill-y', {
      name: 'skill-y',
      source: { type: 'local', path: '/tmp/skill-y' },
      installedAt: 2000,
    });
    // Non-registry key should be ignored
    await storage.set('agent:skill:other', { name: 'other' });

    const records = await installer.listInstalled();

    expect(records).toHaveLength(2);
    expect(records.map((r) => r.name).sort()).toEqual(['skill-x', 'skill-y']);
    expect(records.find((r) => r.name === 'skill-x')?.version).toBe('1.0.0');
  });
});
