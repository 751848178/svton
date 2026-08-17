import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { MainLayout } from '../src/components/MainLayout';
import { AutomationPanelExtra } from '../src/components/ExtraPanels';
import { LiveModelRegistry } from '@svton/agent-app';

const sendMock = vi.fn();
const createMock = vi.fn();
const switchToMock = vi.fn();
const deleteMock = vi.fn();
const updateProjectIdMock = vi.fn();

vi.mock('@svton/agent-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@svton/agent-client')>(),
  useChat: () => ({
    status: 'idle',
    abort: vi.fn(),
    messages: [],
    send: sendMock,
    currentModelKey: { providerId: 'test', modelId: 'test-model' },
    currentPermissionMode: 'default',
    currentReasoningEffort: undefined,
  }),
  useSession: () => ({
    sessions: [{ id: 'session-1', title: 'Session 1' }],
    activityBySessionId: new Map(),
    managementBySessionId: new Map(),
    management: {
      rename: vi.fn(), setPinned: vi.fn(), archive: vi.fn(), stopAndArchive: vi.fn(),
      unarchive: vi.fn(), deletePermanently: vi.fn(),
    },
    search: {
      results: [], query: '', scope: 'active', includeContent: false,
      searching: false, error: null,
      setQuery: vi.fn(), setScope: vi.fn(), setIncludeContent: vi.fn(), retry: vi.fn(),
    },
    currentSessionId: 'session-1',
    create: createMock,
    switchTo: switchToMock,
    delete: deleteMock,
    updateProjectId: updateProjectIdMock,
  }),
  useAgentContext: () => ({
    projectService: {
      projects: [],
      currentProjectId: null,
      createProject: vi.fn(),
      switchProject: vi.fn(),
      getProjectById: vi.fn(),
      deleteProject: vi.fn(),
    },
    chatService: {
      activeSessionId: 'session-1',
      runtimeSettings: {
        setReasoningEffort: vi.fn(),
        getModelSwitchBlockedReason: vi.fn(() => null),
        getPermissionProfileBlockedReason: vi.fn(() => null),
        switchModel: vi.fn(),
        switchPermissionProfile: vi.fn(),
        retryModelDefaultPersistence: vi.fn(),
      },
    },
  }),
}));

vi.mock('../src/components/Sidebar', () => ({
  Sidebar: ({ activeView }: { activeView: string }) => <div data-testid="sidebar" data-view={activeView} />,
}));

vi.mock('../src/components/ChatContent', () => ({
  ChatContent: () => <div data-testid="chat-content" />,
}));

vi.mock('../src/components/SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel" />,
}));

vi.mock('../src/hooks/useGitBranch', () => ({
  useGitBranch: () => 'main',
}));

vi.mock('../src/lib/window-controls', () => ({
  startDragging: vi.fn(),
  toggleMaximize: vi.fn(),
}));

function makePlatform(): TauriPlatform {
  return {
    storage: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(async () => []),
      clear: vi.fn(),
    },
    fs: {
      listDir: vi.fn(async () => {
        throw new Error('skip file mentions in this test');
      }),
    },
    process: {
      getEnv: vi.fn(() => '/tmp'),
    },
  } as unknown as TauriPlatform;
}

function makeConfig(): AgentConfig {
  return {
    model: 'test-model',
    workingDir: '/tmp/project',
    toolRegistry: {
      listDefinitions: vi.fn(() => []),
    },
    capabilities: {
      skillManager: {
        list: vi.fn(() => []),
      },
      permissionManager: {
        getMode: vi.fn(() => 'default'),
        setMode: vi.fn(),
      },
      pluginManager: {
        list: vi.fn(() => []),
      },
    },
  } as unknown as AgentConfig;
}

describe('MainLayout automation trigger binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('binds automation triggers at layout level and sends the prompt', async () => {
    let triggerHandler: ((automation: { prompt: string }) => Promise<void>) | undefined;
    const automationManager = {
      setTriggerHandler: vi.fn((handler) => {
        triggerHandler = handler;
      }),
    };
    const initialModelKey = { providerId: 'test', modelId: 'test-model' };
    const registry = new LiveModelRegistry([{
      id: 'test', name: 'Test', type: 'openai',
      models: [{ id: 'test-model', name: 'Test Model' }],
    }]);

    render(
      <MainLayout
        config={makeConfig()}
        platform={makePlatform()}
        registry={registry}
        initialModelKey={initialModelKey}
        modelSwitchHost={{
          getPersisted: () => initialModelKey,
          prepareConfig: async () => { throw new Error('not used'); },
          persistDefault: async () => {},
        }}
        extra={{ automationManager } as any}
      />,
    );

    await waitFor(() => expect(automationManager.setTriggerHandler).toHaveBeenCalledTimes(1));
    await act(async () => {
      await triggerHandler?.({ prompt: 'Run the daily agent check' });
    });

    expect(sendMock).toHaveBeenCalledWith('Run the daily agent check');
  });

  it('does not let the automation panel replace the layout trigger handler', () => {
    const automationManager = {
      list: vi.fn(() => []),
      getRecentRuns: vi.fn(async () => {
        throw new Error('skip recent runs in this test');
      }),
      setTriggerHandler: vi.fn(),
    };

    render(<AutomationPanelExtra automationManager={automationManager as any} />);

    expect(automationManager.setTriggerHandler).not.toHaveBeenCalled();
  });
});
