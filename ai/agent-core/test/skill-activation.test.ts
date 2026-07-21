/**
 * Runtime skill activation flow tests.
 *
 * Verifies:
 *  - matching user message → runtime yields a `skill_activated` event with the
 *    skill name(s).
 *  - non-matching user message → no `skill_activated` event.
 *  - skill with missing requiredTools is filtered out and not surfaced.
 */
import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/agent/runtime';
import { ToolRegistry } from '../src/tool/registry';
import { SkillManager } from '../src/skill/manager';
import type { SkillDefinition } from '../src/skill/types';
import { MockProvider, createMockPlatform, collectEvents } from './helpers';
import type { AgentEvent } from '../src/agent/types';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';

// A skill that matches "code review" / "审查代码" requests.
const reviewSkill: SkillDefinition = {
  name: 'code-review',
  description: 'Code review against branches, commits, or uncommitted changes',
  triggerSignals: ['审查代码', '代码审查', '/review', 'code review'],
  trigger: { type: 'implicit', patterns: ['审查代码', '代码审查'] },
  requiredTools: ['git_diff'],
  allowedTools: ['git_diff', 'file_read'],
};

// A skill whose required tool is NOT registered → must be filtered out.
const unavailableSkill: SkillDefinition = {
  name: 'needs-missing-tool',
  description: 'A skill requiring a tool that is not registered',
  triggerSignals: ['special-request'],
  requiredTools: ['nonexistent_tool'],
};

function buildRuntime(skills: SkillDefinition[], platform: IPlatform = createMockPlatform()) {
  const provider = new MockProvider();
  provider.addResponse([
    { type: 'text_delta', text: 'done' },
    { type: 'done', stopReason: 'stop' },
  ]);

  const registry = new ToolRegistry();
  // Register git_diff so reviewSkill's requiredTools are satisfied.
  // (the executor is irrelevant for this test — we never let it run; we just
  // need the tool definition to exist so isSkillAvailable returns true.)
  registry.register({
    name: 'git_diff',
    description: 'git diff',
    parameters: { type: 'object' as const, properties: {} },
  }, async () => ({ callId: 'x', output: '' }));

  const skillManager = new SkillManager();
  for (const s of skills) skillManager.register(s);

  const runtime = AgentRuntime.create({
    provider,
    model: 'test-model',
    toolRegistry: registry,
    capabilities: { skillManager },
    workingDir: '/repo',
  }, platform);

  return { runtime, provider };
}

describe('skill_activated event flow', () => {
  it('emits skill_activated when the user message matches a skill', async () => {
    const { runtime } = buildRuntime([reviewSkill]);
    const events = await collectEvents(runtime.run('请帮我做代码审查'));
    const activated = events.filter((e) => e.type === 'skill_activated') as Extract<AgentEvent, { type: 'skill_activated' }>[];
    expect(activated.length).toBe(1);
    expect(activated[0].skills).toContain('code-review');
  });

  it('does NOT emit skill_activated for unrelated messages', async () => {
    const { runtime } = buildRuntime([reviewSkill]);
    const events = await collectEvents(runtime.run('what is 2+2?'));
    const activated = events.filter((e) => e.type === 'skill_activated');
    expect(activated.length).toBe(0);
  });

  it('filters out skills whose requiredTools are not registered', async () => {
    const { runtime } = buildRuntime([reviewSkill, unavailableSkill]);
    // Message matches both skills' triggerSignals, but unavailableSkill should
    // be dropped because its required tool doesn't exist.
    const events = await collectEvents(runtime.run('special-request code review'));
    const activated = events.filter((e) => e.type === 'skill_activated') as Extract<AgentEvent, { type: 'skill_activated' }>[];
    expect(activated.length).toBe(1);
    expect(activated[0].skills).toContain('code-review');
    expect(activated[0].skills).not.toContain('needs-missing-tool');
  });

  it('emits skill_activated before the first text_delta', async () => {
    const { runtime } = buildRuntime([reviewSkill]);
    const events = await collectEvents(runtime.run('审查代码 please'));
    const skillIdx = events.findIndex((e) => e.type === 'skill_activated');
    const textIdx = events.findIndex((e) => e.type === 'text_delta');
    expect(skillIdx).toBeGreaterThanOrEqual(0);
    expect(textIdx).toBeGreaterThanOrEqual(0);
    expect(skillIdx).toBeLessThan(textIdx);
  });

  it('resolves dynamic skill context commands through sandbox exec when available', async () => {
    const processCalls: string[] = [];
    const sandboxCalls: string[] = [];
    const sandboxProfile: SandboxProfile = {
      mode: 'full_access',
      writablePaths: ['/repo'],
      networkAccess: true,
    };
    const platform = createMockPlatform({
      capabilities: { process: true, sandboxing: true },
      process: {
        exec: async (cmd) => {
          processCalls.push(cmd);
          return { stdout: 'raw', stderr: '', exitCode: 0, timedOut: false };
        },
      },
    });
    (platform as any).sandbox = {
      createProfile: () => sandboxProfile,
      exec: async (cmd: string, _opts: unknown, profile: SandboxProfile) => {
        sandboxCalls.push(`${cmd}:${profile.mode}`);
        return { stdout: 'sandboxed', stderr: '', exitCode: 0, timedOut: false };
      },
    };

    const { runtime } = buildRuntime([
      {
        ...reviewSkill,
        instructions: 'Context: !`pwd`',
      },
    ], platform);

    await collectEvents(runtime.run('please code review'));

    expect(processCalls).toEqual([]);
    expect(sandboxCalls).toEqual(['pwd:full_access']);
    expect(runtime.getMessages().some((m) =>
      typeof m.content === 'string' && m.content.includes('Context: sandboxed'),
    )).toBe(true);
  });

  it('does not fall back to raw process exec when dynamic skill context requires sandbox', async () => {
    const processCalls: string[] = [];
    const platform = createMockPlatform({
      capabilities: { process: true, sandboxing: true },
      process: {
        exec: async (cmd) => {
          processCalls.push(cmd);
          return { stdout: 'raw', stderr: '', exitCode: 0, timedOut: false };
        },
      },
    });

    const { runtime } = buildRuntime([
      {
        ...reviewSkill,
        instructions: 'Context: !`pwd`',
      },
    ], platform);

    await collectEvents(runtime.run('please code review'));

    expect(processCalls).toEqual([]);
    expect(runtime.getMessages().some((m) =>
      typeof m.content === 'string'
        && m.content.includes('requires sandbox execution'),
    )).toBe(true);
  });
});
