/**
 * ChatService skill_activated event handling.
 *
 * Verifies that when the runtime emits `skill_activated`, ChatService stores
 * the skill names on the assistant message's `activeSkills` field, so the UI
 * (ActivityIndicator) can render "正在使用 <skill>...".
 *
 * PI007: the runtime is Pi-backed; the skill_activated event is scripted via
 * EventScripter (it originates from the runtime's skill-trigger hook).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import { ChatService } from '../src/service/chat.service';
import { ToolRegistry, SkillManager } from '@svton/agent-core';
import type { AgentEvent } from '@svton/agent-core';
import { buildPiAgentConfig, EventScripter, makeBrowserPlatform } from './helpers/pi-test-utils';

function buildService() {
  const registry = new ToolRegistry();
  const skillManager = new SkillManager();
  skillManager.register({
    name: 'code-review', description: 'review',
    triggerSignals: ['审查代码', '代码审查'],
    trigger: { type: 'implicit', patterns: ['审查代码'] },
    requiredTools: ['git_diff'],
  });
  const service = new ChatService();
  const config = buildPiAgentConfig({
    toolRegistry: registry,
    capabilities: { skillManager },
  }).config;
  return { service, skillManager, registry, config };
}

describe('ChatService skill_activated handling', () => {
  let service: ChatService;
  let scripter: EventScripter;

  beforeEach(async () => {
    const ctx = buildService();
    service = ctx.service;
    await service.init(makeBrowserPlatform(), ctx.config);
    scripter = new EventScripter(service as unknown as { runtime: { run: (...args: any[]) => AsyncGenerator<AgentEvent> } });
  });

  it('sets activeSkills on the assistant message when a skill matches', async () => {
    // Script the skill-activation signal the runtime emits when a skill matches.
    scripter.addResponse([
      { type: 'skill_activated', skills: ['code-review'] },
      { type: 'text_delta', text: 'reviewing' },
      { type: 'done', stopReason: 'stop' },
    ]);

    await service.sendMessage('请帮我做代码审查');

    const assistant = service.messages.find((m) => m.role === 'assistant');
    expect(assistant).toBeDefined();
    expect(assistant!.activeSkills).toContain('code-review');
  });

  it('leaves activeSkills undefined when no skill matches', async () => {
    scripter.addResponse([
      { type: 'text_delta', text: 'hi' },
      { type: 'done', stopReason: 'stop' },
    ]);

    await service.sendMessage('what is 2+2?');

    const assistant = service.messages.find((m) => m.role === 'assistant');
    expect(assistant).toBeDefined();
    expect(assistant!.activeSkills).toBeUndefined();
  });
});
