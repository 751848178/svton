import 'reflect-metadata';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TauriPlatform } from '@svton/agent-platform';
import { useStartupTask } from '@svton/agent-client';
import { StartupStateView, type ChatPanelMessage } from '@svton/agent-ui';
import { initAgent, type AgentExtra } from '@/lib/agent-setup';
import { createDefaultConfig, openConfigInEditor } from '@/lib/config-store';
import { loadDesktopAgentConfig } from '@/lib/desktop-agent-config.service';
import type { View } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { startDesktopE2eBootstrap } from '@/lib/desktop-e2e-bootstrap.service';
import { parseAgentWindowParams } from '@/lib/agent-window-params.utils';
import { PreviewWindow } from '@/components/PreviewWindow.component';
import { ConfiguredAgentApp } from '@/components/ConfiguredAgentApp.component';
import { DesktopSessionSearchE2eFixture } from '@/components/DesktopSessionSearchE2eFixture';
import { UnconfiguredAgentApp } from '@/components/UnconfiguredAgentApp.component';
import {
  createDesktopModelRegistry,
  desktopConfiguredModelKey,
  toDesktopRegistrySources,
} from '@/lib/desktop-model-registry';
import { encodeModelKey, type ModelKey } from '@svton/agent-client';
import type { LiveModelRegistry } from '@svton/agent-app';
import { desktopE2eActive } from '@/lib/e2e-provider';

interface DesktopReadyState {
  config: Awaited<ReturnType<typeof initAgent>> & { kind: 'ready' };
  modelKey: ModelKey;
}

export default function App() {
  const windowParams = parseAgentWindowParams(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  if (windowParams.isPreview) return <PreviewWindow />;
  if (desktopE2eActive()
    && new URLSearchParams(window.location.search).get('desktop-search-fixture') === '1') {
    return <DesktopSessionSearchE2eFixture />;
  }

  const [platform] = useState(() => new TauriPlatform());
  const [registry] = useState<LiveModelRegistry>(createDesktopModelRegistry);
  const bootstrap = useMemo(() => startDesktopE2eBootstrap(platform), [platform]);
  const [unconfiguredMessages, setUnconfiguredMessages] = useState<ChatPanelMessage[]>([]);
  const [unconfiguredView, setUnconfiguredView] = useState<View>('chat');
  const startupKey = useMemo(() => ({ platform }), [platform]);
  const startup = useStartupTask<DesktopReadyState>({
    source: 'config',
    generationKey: startupKey,
    load: async () => {
      await bootstrap.started;
      const stored = await loadDesktopAgentConfig(platform);
      if (stored.config) registry.replace(toDesktopRegistrySources(stored.config));
      const modelKey = stored.config ? desktopConfiguredModelKey(stored.config) : null;
      const result = await initAgent(
        platform,
        modelKey ? encodeModelKey(modelKey) : undefined,
      );
      if (result.kind === 'ready') {
        if (!modelKey) throw new Error('桌面模型配置缺少 Provider-qualified identity。');
        return { kind: 'ready', value: { config: result, modelKey } };
      }
      await bootstrap.failInitialization(result.kind);
      if (result.kind === 'no_config') await createDefaultConfig(platform);
      if (result.kind === 'no_config' || result.kind === 'no_api_key') {
        return {
          kind: 'noConfiguration',
          cause: result.kind === 'no_config'
            ? 'Agent 配置文件尚未完成。'
            : 'Provider API Key 尚未配置。',
        };
      }
      throw new Error(result.message);
    },
  });

  useEffect(() => () => bootstrap.dispose(), [bootstrap]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        void openConfigInEditor(platform);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [platform]);
  useEffect(() => {
    if (startup.state.phase !== 'noConfiguration') return;
    const retry = () => startup.retry();
    window.addEventListener('focus', retry);
    return () => window.removeEventListener('focus', retry);
  }, [startup.state.phase, startup.retry]);

  const handleEditConfig = useCallback(
    () => openConfigInEditor(platform),
    [platform],
  );
  const handleReinit = useCallback(async (workingDir?: string) => {
    if (workingDir) await platform.storage.set('agent:workingDir', workingDir);
    startup.retry();
  }, [platform, startup.retry]);
  const unconfiguredMsgCounter = useRef(0);
  const handleUnconfiguredSend = useCallback(async (content: string) => {
    const id = ++unconfiguredMsgCounter.current;
    setUnconfiguredMessages((messages) => [...messages,
      { id: `user-${id}`, role: 'user', content },
      {
        id: `assistant-${id}`,
        role: 'assistant',
        content: '尚未配置 API Key。请按 **Cmd+,** 打开配置文件并完成 Provider 配置。',
      },
    ]);
    await openConfigInEditor(platform);
  }, [platform]);

  if (startup.state.phase === 'loading' || startup.state.phase === 'error') {
    return <StartupStateView state={startup.state} onRetry={startup.retry} />;
  }
  if (startup.state.phase === 'noConfiguration') {
    return (
      <UnconfiguredAgentApp
        platform={platform}
        view={unconfiguredView}
        setView={setUnconfiguredView}
        messages={unconfiguredMessages}
        onSend={handleUnconfiguredSend}
        onEditConfig={handleEditConfig}
        unconfigured
      />
    );
  }
  const ready = startup.state.value;
  const config = ready.config.config;
  return (
    <ErrorBoundary>
      <ConfiguredAgentApp
        platform={platform}
        config={config}
        initialSessionId={windowParams.sessionId}
        registry={registry}
        initialModelKey={ready.modelKey}
        onReinit={handleReinit}
        extra={ready.config.extra as AgentExtra | undefined}
      />
    </ErrorBoundary>
  );
}
