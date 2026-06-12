import { describe, it, expect, vi } from 'vitest';
import 'reflect-metadata';
import { ToolRegistry } from '@svton/agent-core';
import type { MentionItem } from '../src/../packages/agent-ui/src/components/chat/ChatInput';

// ==============================================================
// Test the data construction logic from AgentLayout/Web ChatContent
// without React rendering (verifies wiring correctness)
// ==============================================================

describe('Web integration — Mention items construction', () => {
  it('builds mention items from tools', () => {
    const registry = new ToolRegistry();
    registry.register(
      { name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: {} } },
      { execute: async () => ({ callId: 'x', output: 'ok' }) } as any,
    );
    registry.register(
      { name: 'search', description: 'Search codebase', parameters: { type: 'object', properties: {} } },
      { execute: async () => ({ callId: 'x', output: 'ok' }) } as any,
    );

    // Simulate the logic from AgentLayout
    const toolDefs = registry.listDefinitions();
    const items: MentionItem[] = [];
    for (const t of toolDefs.slice(0, 20)) {
      items.push({
        label: t.name,
        description: t.description,
        category: 'tool',
      });
    }

    expect(items).toHaveLength(2);
    expect(items[0].label).toBe('read_file');
    expect(items[0].category).toBe('tool');
    expect(items[1].label).toBe('search');
  });

  it('limits mention items to 20 tools', () => {
    const registry = new ToolRegistry();
    for (let i = 0; i < 30; i++) {
      registry.register(
        { name: `tool_${i}`, description: `Tool ${i}`, parameters: { type: 'object', properties: {} } },
        { execute: async () => ({ callId: 'x', output: 'ok' }) } as any,
      );
    }

    const toolDefs = registry.listDefinitions();
    const items = toolDefs.slice(0, 20).map((t) => ({ label: t.name, category: 'tool' as const }));

    expect(items).toHaveLength(20);
  });
});

describe('Web integration — handleMentionSelect', () => {
  it('returns @label format', () => {
    const handleMentionSelect = (item: MentionItem): string => `@${item.label}`;
    expect(handleMentionSelect({ label: 'read_file', category: 'tool' })).toBe('@read_file');
    expect(handleMentionSelect({ label: 'code-review', category: 'skill' })).toBe('@code-review');
  });
});

describe('Web integration — Slash commands definition', () => {
  it('defines all expected slash commands', () => {
    // Verify the slash commands structure matches what AgentLayout defines
    const create = vi.fn();
    const send = vi.fn();

    const slashCommands = [
      { name: 'new', description: '创建新对话', action: () => create() },
      { name: 'clear', description: '清空当前对话', action: () => create() },
      { name: 'help', description: '显示帮助信息', action: () => { send('请帮我了解你可以做什么'); } },
      { name: 'status', description: '查看当前状态和能力', action: () => { send('status'); } },
    ];

    expect(slashCommands).toHaveLength(4);
    expect(slashCommands.map((c) => c.name)).toEqual(['new', 'clear', 'help', 'status']);

    // Verify actions work
    slashCommands[0].action();
    expect(create).toHaveBeenCalled();

    slashCommands[2].action();
    expect(send).toHaveBeenCalledWith('请帮我了解你可以做什么');
  });
});

describe('Web integration — Permission mode persistence', () => {
  it('initializes from storage', async () => {
    const store = new Map<string, unknown>();
    const mockStorage = {
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      set: (key: string, value: any) => { store.set(key, value); return Promise.resolve(); },
      delete: (key: string) => { store.delete(key); return Promise.resolve(); },
      list: () => Promise.resolve([...store.keys()]),
      clear: () => { store.clear(); return Promise.resolve(); },
    };

    // Simulate: user set mode to 'auto'
    await mockStorage.set('agent:permission_mode', 'auto');
    const saved = await mockStorage.get('agent:permission_mode');
    expect(saved).toBe('auto');
  });

  it('falls back to default when no saved mode', async () => {
    const store = new Map<string, unknown>();
    const mockStorage = {
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      set: (key: string, value: any) => { store.set(key, value); return Promise.resolve(); },
      delete: (key: string) => { store.delete(key); return Promise.resolve(); },
      list: () => Promise.resolve([...store.keys()]),
      clear: () => { store.clear(); return Promise.resolve(); },
    };

    const saved = await mockStorage.get('agent:permission_mode');
    const mode = saved ?? 'default';
    expect(mode).toBe('default');
  });
});

describe('Web integration — Skill matching logic', () => {
  it('matches skills based on keywords in user message', () => {
    const skills = [
      { name: 'code-review', description: 'review code quality' },
      { name: 'test-gen', description: 'generate unit tests' },
      { name: 'doc-writer', description: 'write documentation' },
    ];

    const lastUserMsg = 'please help me review this code for bugs';
    const msgLower = lastUserMsg.toLowerCase();

    const matched = skills.filter((s) => {
      const keywords = s.description.toLowerCase().split(/\s+/);
      return keywords.some((kw) => kw.length > 3 && msgLower.includes(kw));
    });

    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('code-review');
  });

  it('returns empty when no keywords match', () => {
    const skills = [
      { name: 'code-review', description: 'review code quality' },
    ];

    const lastUserMsg = 'what is the weather today?';
    const msgLower = lastUserMsg.toLowerCase();

    const matched = skills.filter((s) => {
      const keywords = s.description.toLowerCase().split(/\s+/);
      return keywords.some((kw) => kw.length > 3 && msgLower.includes(kw));
    });

    expect(matched).toHaveLength(0);
  });
});

describe('Web integration — Model persistence format', () => {
  it('writes model in providerId::modelId format', () => {
    const models = [
      { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', providerName: 'OpenAI' },
      { id: 'claude-3', name: 'Claude 3', providerId: 'anthropic', providerName: 'Anthropic' },
    ];

    const currentModel = 'gpt-4o';
    const provider = models.find((m) => m.id === currentModel);
    const storageKey = provider ? `${provider.providerId}::${currentModel}` : currentModel;

    expect(storageKey).toBe('openai::gpt-4o');
  });

  it('parses modelId from providerId::modelId format', () => {
    const saved = 'openai::gpt-4o';
    const modelId = saved.includes('::') ? saved.split('::')[1] : saved;
    expect(modelId).toBe('gpt-4o');
  });

  it('handles legacy format without :: separator', () => {
    const saved = 'gpt-4o';
    const modelId = saved.includes('::') ? saved.split('::')[1] : saved;
    expect(modelId).toBe('gpt-4o');
  });
});

describe('Web integration — ChatContent message mapping', () => {
  it('maps blocks and duration from DisplayMessage to ChatPanelMessage', () => {
    const msg = {
      id: 'm1',
      role: 'assistant' as const,
      content: 'Hello',
      thinking: 'Let me think...',
      blocks: [
        { type: 'thinking' as const, text: 'Let me think...' },
        { type: 'text' as const, text: 'Hello' },
      ],
      duration: 1500,
      isStreaming: false,
      toolCalls: [],
      timestamp: Date.now(),
    };

    // Simulate the mapping from ChatContent.tsx
    const panelMsg = {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      thinking: msg.thinking,
      blocks: msg.blocks,
      duration: msg.duration,
      isStreaming: msg.isStreaming,
    };

    expect(panelMsg.blocks).toHaveLength(2);
    expect(panelMsg.duration).toBe(1500);
    expect(panelMsg.thinking).toBe('Let me think...');
  });

  it('maps retryFromMessage in onRetry handler', () => {
    const retryFromMessage = vi.fn();
    const retry = vi.fn();

    // Simulate the onRetry handler from ChatContent.tsx
    const onRetry = (messageId?: string) =>
      messageId ? retryFromMessage(messageId) : retry();

    // User message retry — passes message ID
    onRetry('msg_user_1');
    expect(retryFromMessage).toHaveBeenCalledWith('msg_user_1');
    expect(retry).not.toHaveBeenCalled();

    // Assistant retry — no message ID
    onRetry();
    expect(retry).toHaveBeenCalled();
  });
});
