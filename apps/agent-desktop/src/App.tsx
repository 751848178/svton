import 'reflect-metadata';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { AgentProvider, useChat, useSession } from '@svton/agent-client';
import { ChatPanel, type ChatPanelMessage } from '@svton/agent-ui';
import { initAgent } from '@/lib/agent-setup';
import { loadConfig, createDefaultConfig, openConfigInEditor } from '@/lib/config-store';
import { Sidebar, type View } from '@/components/Sidebar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MainLayout } from '@/components/MainLayout';

// ── App ──────────────────────────────────────────────────
export default function App() {
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [platform, setPlatform] = useState<TauriPlatform | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [unconfiguredMessages, setUnconfiguredMessages] = useState<ChatPanelMessage[]>([]);
  const [unconfiguredView, setUnconfiguredView] = useState<View>('chat');

  // ── Model switching state ──
  const [currentModel, setCurrentModel] = useState('');
  const [models, setModels] = useState<{ id: string; name: string; providerName: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = new TauriPlatform();
      setPlatform(p);

      try {
        // Load full config to build models list from ALL providers
        const configResult = await loadConfig(p);
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
          setCurrentModel(result.config.model);
        } else {
          setUnconfigured(true);
          if (result.kind === 'no_config') {
            await createDefaultConfig(p);
          }
          console.warn('[App] initAgent result:', result.kind, result.kind === 'error' ? (result as any).message : '');
        }
      } catch (err) {
        console.error('[App] initAgent threw:', err);
        setUnconfigured(true);
      }
    })();
    return () => { cancelled = true; };
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
        <AgentProvider platform={platform} config={agentConfig}>
          <MainLayout
            config={agentConfig}
            platform={platform}
            models={models}
            currentModel={currentModel}
            setCurrentModel={setCurrentModel}
            onReinit={async (workingDir?: string) => {
              if (workingDir) {
                await platform.storage.set('agent:workingDir', workingDir);
                // Immediately update workingDir for UI responsiveness (mention cache, etc.)
                setAgentConfig(prev => prev ? { ...prev, workingDir } : prev);
              }
              // Full re-init in background for skills, MCP, memory
              const result = await initAgent(platform, currentModel);
              if (result.kind === 'ready') {
                setAgentConfig(result.config);
              }
            }}
          />
        </AgentProvider>
      ) : unconfiguredView === 'settings' && platform ? (
        // Settings: full-screen — no Sidebar
        <div className="flex flex-col h-screen bg-black text-gray-100 font-mono">
          {/* Draggable spacer for macOS traffic light buttons */}
          <div
            onMouseDown={() => {}}
            className="h-9 flex-shrink-0 cursor-default select-none"
          />
          <SettingsPanel platform={platform} onBack={() => setUnconfiguredView('chat')} />
        </div>
      ) : (
        <div className="flex h-screen bg-transparent text-gray-100 font-mono">
          {platform && (
            <Sidebar
              config={null}
              sessions={[]}
              currentSessionId={null}
              projects={[]}
              currentProjectId={null}
              onNewChat={() => {}}
              onSwitchSession={() => {}}
              onDeleteSession={() => {}}
              onNavigate={(v) => setUnconfiguredView(v)}
              onSwitchProject={() => {}}
              onOpenProjectFolder={() => {}}
              onDeleteProject={() => {}}
              activeView={unconfiguredView}
            />
          )}
          <div className="flex-1 flex flex-col min-w-0">
            {(unconfiguredView === 'chat' || unconfiguredView === 'search') && (
              <ChatPanel
                messages={unconfiguredMessages}
                onSend={handleUnconfiguredSend}
                disabled={false}
                placeholder="Press Cmd+, to configure..."
                emptyMessage={unconfigured ? (
                  <div className="text-center py-8">
                    <h2 className="text-2xl text-white font-light tracking-tight mb-2">
                      Welcome to Svton
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                      按 Cmd+, 打开配置文件，填入 API Key 即可开始
                    </p>
                    <button
                      onClick={() => handleEditConfig()}
                      className="px-5 py-2 text-sm font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                    >
                      打开配置文件
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">Loading...</p>
                  </div>
                )}
                presets={[]}
                className="bg-transparent"
              />
            )}
            {(unconfiguredView === 'automation' || unconfiguredView === 'skills') && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-lg text-white font-light mb-2">
                    {unconfiguredView === 'automation' ? '自动化' : '技能'}
                  </h2>
                  <p className="text-sm text-gray-500">请先完成配置后使用</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
