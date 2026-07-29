import 'reflect-metadata';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import type { ChatPanelMessage } from '@svton/agent-ui';
import { initAgent, type AgentExtra } from '@/lib/agent-setup';
import { createDefaultConfig, openConfigInEditor } from '@/lib/config-store';
import { loadDesktopAgentConfig } from '@/lib/desktop-agent-config.service';
import type { View } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { startDesktopE2eBootstrap } from '@/lib/desktop-e2e-bootstrap.service';
import { parseAgentWindowParams } from '@/lib/agent-window-params.utils';
import { PreviewWindow } from '@/components/PreviewWindow.component';
import { ConfiguredAgentApp } from '@/components/ConfiguredAgentApp.component';
import { UnconfiguredAgentApp } from '@/components/UnconfiguredAgentApp.component';

// ── App ──────────────────────────────────────────────────
export default function App() {
  const windowParams = parseAgentWindowParams(
    typeof window === 'undefined' ? '' : window.location.search,
  );

  if (windowParams.isPreview) {
    return <PreviewWindow />;
  }
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [agentExtra, setAgentExtra] = useState<AgentExtra | null>(null);
  const [platform, setPlatform] = useState<TauriPlatform | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [unconfiguredMessages, setUnconfiguredMessages] = useState<ChatPanelMessage[]>([]);
  const [unconfiguredView, setUnconfiguredView] = useState<View>('chat');

  // ── Model switching state ──
  const [currentModel, setCurrentModel] = useState('');
  const [models, setModels] = useState<{ id: string; name: string; providerName: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    let bootstrap: ReturnType<typeof startDesktopE2eBootstrap> | undefined;
    (async () => {
      const p = new TauriPlatform();
      setPlatform(p);
      bootstrap = startDesktopE2eBootstrap(p);
      try {
        await bootstrap.started;
        const configResult = await loadDesktopAgentConfig(p);
        if (configResult.config) {
          const allModels: { id: string; name: string; providerName: string }[] = [];
          for (const [providerName, providerCfg] of Object.entries(configResult.config.providers)) {
            for (const [modelId, displayName] of Object.entries(providerCfg.models || {})) {
              allModels.push({ id: modelId, name: displayName || modelId, providerName });
            }
          }
          if (!cancelled) setModels(allModels);
        }

        const result = await initAgent(p);
        if (cancelled) return;

        if (result.kind === 'ready') {
          setAgentConfig(result.config);
          setAgentExtra(result.extra ?? null);
          setCurrentModel(result.config.model);
        } else {
          await bootstrap.failInitialization(result.kind);
          setUnconfigured(true);
          if (result.kind === 'no_config') {
            await createDefaultConfig(p);
          }
          console.warn('[App] initAgent result:', result.kind, result.kind === 'error' ? (result as any).message : '');
        }
      } catch (err) {
        await bootstrap.failInitialization('exception');
        console.error('[App] initAgent threw:', err);
        setUnconfigured(true);
      }
    })();
    return () => { cancelled = true; bootstrap?.dispose(); };
  }, []);

  // ── Re-init agent when model changes ──
  const platformRef = useRef<TauriPlatform | null>(null);
  platformRef.current = platform;

  useEffect(() => {
    if (!currentModel || !platformRef.current) return;
    // Skip the initial load (already handled by startup effect)
    if (currentModel === agentConfig?.model) return;

    let cancelled = false;
    initAgent(platformRef.current, currentModel)
      .then((result) => {
        if (cancelled) return;
        if (result.kind === 'ready') {
          setAgentConfig(result.config);
          setAgentExtra(result.extra ?? null);
        }
      })
      .catch((e) => console.error('[App] model switch failed:', e));
    return () => { cancelled = true; };
  }, [currentModel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+, shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        if (platform) openConfigInEditor(platform);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [platform]);

  // Auto-reload on focus — only when unconfigured
  useEffect(() => {
    if (agentConfig) return;
    const handler = async () => {
      if (!platform) return;
      try {
        const result = await initAgent(platform);
        if (result.kind === 'ready') {
          setAgentConfig(result.config);
          setAgentExtra(result.extra ?? null);
          setCurrentModel(result.config.model);
          setUnconfigured(false);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [platform, agentConfig]);

  const handleEditConfig = useCallback(async () => {
    if (platform) await openConfigInEditor(platform);
  }, [platform]);

  const handleReinit = useCallback(async (workingDir?: string) => {
    if (!platform) return;
    if (workingDir) {
      await platform.storage.set('agent:workingDir', workingDir);
      setAgentConfig(prev => prev ? { ...prev, workingDir } : prev);
    }
    const result = await initAgent(platform, currentModel);
    if (result.kind === 'ready') {
      setAgentConfig(result.config);
      setAgentExtra(result.extra ?? null);
    }
  }, [platform, currentModel]);

  // R6 fix: use incrementing counter to avoid ID collision
  const unconfiguredMsgCounter = useRef(0);
  const handleUnconfiguredSend = useCallback(async (content: string) => {
    const id = ++unconfiguredMsgCounter.current;
    setUnconfiguredMessages(prev => [
      ...prev,
      { id: `user-${id}`, role: 'user' as const, content },
      {
        id: `assistant-${id}`,
        role: 'assistant' as const,
        content: '尚未配置 API Key。请按 **Cmd+,** 打开配置文件 `~/.svton/config.toml`，在对应 provider 下填入 `api_key`。配置完成后切回应用即可自动加载。',
      },
    ]);
    if (platform) await openConfigInEditor(platform);
  }, [platform]);

  return (
    <ErrorBoundary>
      {agentConfig && platform ? (
        <ConfiguredAgentApp
          platform={platform}
          config={agentConfig}
          initialSessionId={windowParams.sessionId}
          models={models}
          currentModel={currentModel}
          setCurrentModel={setCurrentModel}
          onReinit={handleReinit}
          extra={agentExtra ?? undefined}
        />
      ) : (
        <UnconfiguredAgentApp
          platform={platform}
          view={unconfiguredView}
          setView={setUnconfiguredView}
          messages={unconfiguredMessages}
          onSend={handleUnconfiguredSend}
          onEditConfig={handleEditConfig}
          unconfigured={unconfigured}
        />
      )}
    </ErrorBoundary>
  );
}
