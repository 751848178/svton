import { useMemo } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatService } from '../service/chat.service';
import type { ProjectService } from '../service/project.service';
import type { SessionService } from '../service/session.service';
import type { StartupState } from './startup-state';
import { useStartupTask, type StartupTaskController } from './use-startup-task';
import type { ModelKey } from '../model-switch/model-switch.types';

interface AgentProviderStartupOptions {
  platform: IPlatform;
  config: AgentConfig;
  runtimeKey?: string;
  modelKey?: ModelKey;
  chatService: ChatService;
  sessionService: SessionService;
  projectService: ProjectService;
  beforeSource?: (source: 'chat' | 'session' | 'project') => void | Promise<void>;
}

/** Keeps provider service failures separately retryable without rerunning healthy sources. */
export function useAgentProviderStartup({
  platform,
  config,
  runtimeKey,
  modelKey,
  chatService,
  sessionService,
  projectService,
  beforeSource,
}: AgentProviderStartupOptions): StartupTaskController<void> {
  const chatKey = useMemo(
    () => ({ platform, config, runtimeKey, modelKey }),
    [platform, config, runtimeKey, modelKey],
  );
  const storageKey = useMemo(() => ({ storage: platform.storage }), [platform.storage]);
  const chat = useStartupTask({
    source: 'chat',
    generationKey: chatKey,
    load: async () => {
      await beforeSource?.('chat');
      await chatService.init(platform, config, runtimeKey, modelKey);
      return { kind: 'ready', value: undefined };
    },
  });
  const session = useStartupTask({
    source: 'session',
    generationKey: storageKey,
    load: async () => {
      await beforeSource?.('session');
      await sessionService.init(platform.storage);
      return { kind: 'ready', value: undefined };
    },
  });
  const project = useStartupTask({
    source: 'project',
    generationKey: storageKey,
    load: async () => {
      await beforeSource?.('project');
      await projectService.init(platform.storage);
      return { kind: 'ready', value: undefined };
    },
  });
  return useMemo(
    () => combineStartupControllers([chat, session, project]),
    [chat.state, chat.retry, session.state, session.retry, project.state, project.retry],
  );
}

export function combineStartupControllers(
  controllers: StartupTaskController<void>[],
): StartupTaskController<void> {
  const failed = controllers.find((item) => item.state.phase === 'error');
  if (failed) return failed;
  const unconfigured = controllers.find((item) => item.state.phase === 'noConfiguration');
  if (unconfigured) return unconfigured;
  const loading = controllers.find((item) => item.state.phase === 'loading');
  if (loading) return loading;
  const generation = Math.max(...controllers.map((item) => item.state.generation));
  const state: StartupState<void> = {
    phase: 'ready', source: 'provider', generation, value: undefined,
  };
  return { state, retry: () => {} };
}
