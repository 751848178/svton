import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 'reflect-metadata';
import { AgentProvider } from '@svton/agent-client';
import { ToolRegistry, type AgentConfig, type StreamEvent } from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';
import { AgentShell } from '../src/components/AgentShell';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@svton/agent-ui', async () => {
  const React = await import('react');

  return {
    ChatPanel: ({ messages, onSend }: { messages: Array<{ id: string; content: string }>; onSend: (content: string) => void }) =>
      React.createElement(
        'div',
        null,
        React.createElement('textarea', {
          'aria-label': 'chat-input',
          onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSend((event.currentTarget as HTMLTextAreaElement).value);
              (event.currentTarget as HTMLTextAreaElement).value = '';
            }
          },
        }),
        ...messages.map((message) => React.createElement('div', { key: message.id }, message.content)),
      ),
    SettingsView: () => React.createElement('div', null),
    Sidebar: () => React.createElement('aside', null),
    SplitScreenPanel: () => React.createElement('div', null),
  };
});

class MemoryStorage implements IStorage {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    return Array.from(this.values.keys()).filter((key) => !prefix || key.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.values.clear();
  }
}

class MockProvider {
  readonly name = 'mock';
  readonly models = [{ id: 'mock-model', name: 'Mock Model', contextWindow: 128000, supportsToolUse: true, supportsStreaming: true }];

  async *chat(): AsyncGenerator<StreamEvent> {
    yield { type: 'text_delta', text: 'Hello from the runtime' };
    yield { type: 'done', stopReason: 'stop' };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return false;
  }
}

function makePlatform(storage: IStorage): IPlatform {
  return {
    type: 'browser',
    capabilities: {
      filesystem: false,
      process: false,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
      sandboxing: false,
      pty: false,
      documentPreview: false,
      computerUse: false,
    },
    fs: {} as any,
    process: {} as any,
    storage,
    search: {} as any,
  };
}

function makeConfig(): AgentConfig {
  return {
    provider: new MockProvider() as any,
    model: 'mock-model',
    toolRegistry: new ToolRegistry(),
    workingDir: '/',
  };
}

describe('AgentShell user flow', () => {
  it('sends a prompt through the UI and renders the assistant response', async () => {
    const storage = new MemoryStorage();
    const config = makeConfig();
    const user = userEvent.setup();

    render(
      <AgentProvider platform={makePlatform(storage)} config={config}>
        <AgentShell
          config={config}
          adapter={{ savePermissionMode: async () => {} }}
          models={[{
            key: 'mock::mock-model',
            id: 'mock-model',
            name: 'Mock Model',
            providerId: 'mock',
            providerName: 'Mock',
            providerType: 'mock',
          }]}
          currentModel="mock::mock-model"
          onModelChange={() => {}}
        />
      </AgentProvider>,
    );

    await user.type(screen.getByRole('textbox'), 'Say hello{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Say hello')).toBeTruthy();
      expect(screen.getByText('Hello from the runtime')).toBeTruthy();
    });
  });
});
