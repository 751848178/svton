import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { MainLayout } from '../src/components/MainLayout';
import { AutomationPanelExtra } from '../src/components/ExtraPanels';

const sendMock = vi.fn();
const createMock = vi.fn();
const switchToMock = vi.fn();
const deleteMock = vi.fn();
const updateProjectIdMock = vi.fn();

vi.mock('@svton/agent-client', () => ({
  useChat: () => ({
    status: 'idle',
    abort: vi.fn(),
    messages: [],
    send: sendMock,
  }),
  useSession: () => ({
    sessions: [{ id: 'session-1', title: 'Session 1' }],
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
      setReasoningEffort: vi.fn(),
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

    render(
      <MainLayout
        config={makeConfig()}
        platform={makePlatform()}
        models={[{ id: 'test-model', name: 'Test Model', providerName: 'Test' }]}
        currentModel="test-model"
        setCurrentModel={vi.fn()}
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
