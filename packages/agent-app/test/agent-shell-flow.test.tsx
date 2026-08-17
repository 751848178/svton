import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 'reflect-metadata';
import { AgentProvider } from '@svton/agent-client';
import {
  SvtonAgentRuntime,
  ToolRegistry,
  type AgentConfig,
  type PublicRuntimeEvent,
} from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';
import {
  createMockModels,
  nativeAssistantLifecycle,
  nativeTextDelta,
} from '../../../ai/agent-core/test/helpers';
import { AgentShell } from '../src/components/AgentShell';
import { LiveModelRegistry } from '../src/models/model-registry';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@svton/agent-ui', async () => {
  const React = await import('react');

  return {
    ChatPanel: ({ messages, interaction }: {
      messages: Array<{ id: string; content: string }>;
      interaction: {
        createOperationId: () => string;
        dispatch: (intent: unknown) => Promise<unknown>;
      };
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('textarea', {
          'aria-label': 'chat-input',
          onKeyDown: async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              const textarea = event.currentTarget;
              const text = textarea.value;
              textarea.value = '';
              await interaction.dispatch({
                id: interaction.createOperationId(),
                kind: 'turn.send',
                draft: { text, attachments: [] },
              });
            }
          },
        }),
        ...messages.map((message) => React.createElement('div', { key: message.id }, message.content)),
      ),
    SettingsView: () => React.createElement('div', null),
    Sidebar: () => React.createElement('aside', null),
    ResponsiveAgentFrame: ({ sidebar, header, compactHeader, children }: {
      sidebar: React.ReactNode;
      header?: React.ReactNode;
      compactHeader?: React.ReactNode;
      children: React.ReactNode;
    }) => React.createElement('div', null, sidebar, header ?? compactHeader, children),
    ResponsiveArtifactHost: ({ chat }: { chat: React.ReactNode }) =>
      React.createElement('div', null, chat),
    ArtifactHostStatus: () => null,
    ArtifactPanel: () => React.createElement('div', null),
    SplitScreenPanel: () => React.createElement('div', null),
    ModelSelector: () => null,
    SessionSettingsControls: () => null,
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

/**
 * Build a Pi-backed AgentConfig plus a runtime.run spy that yields a canned
 * "Hello from the runtime" response. The test uses a fauxProvider-backed
 * Models collection and a native Pi event script.
 */
function makeConfig(): { config: AgentConfig; scriptRun: () => void } {
  const mock = createMockModels('mock-model');
  const config: AgentConfig = {
    models: mock.models,
    piModel: mock.model,
    model: 'mock-model',
    toolRegistry: new ToolRegistry(),
    workingDir: '/',
  };
  const scriptRun = () => {
    vi.spyOn(SvtonAgentRuntime.prototype, 'run').mockImplementation(() => {
      const events: PublicRuntimeEvent[] = [
        nativeTextDelta('Hello from the runtime'),
        ...nativeAssistantLifecycle({ content: 'Hello from the runtime' }),
      ];
      return (async function* () {
        for (const ev of events) yield ev;
      })();
    });
  };
  return { config, scriptRun };
}

describe('AgentShell user flow', () => {
  it('sends a prompt through the UI and renders the assistant response', async () => {
    const storage = new MemoryStorage();
    const { config, scriptRun } = makeConfig();
    scriptRun();
    const user = userEvent.setup();
    const modelKey = { providerId: 'mock', modelId: 'mock-model' };
    const modelRegistry = new LiveModelRegistry([{
      id: 'mock', name: 'Mock', type: 'openai',
      models: [{ id: 'mock-model', name: 'Mock Model' }],
    }]);

    render(
      <AgentProvider platform={makePlatform(storage)} config={config} modelKey={modelKey}>
        <AgentShell
          config={config}
          adapter={{ savePermissionMode: async () => {} }}
          modelRegistry={modelRegistry}
          modelSwitchHost={{
            getPersisted: () => modelKey,
            prepareConfig: async () => { throw new Error('not used'); },
            persistDefault: async () => {},
          }}
          initialModelKey={modelKey}
        />
      </AgentProvider>,
    );

    await user.type(await screen.findByRole('textbox'), 'Say hello{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Say hello')).toBeTruthy();
      expect(screen.getByText('Hello from the runtime')).toBeTruthy();
    });
  });
});
