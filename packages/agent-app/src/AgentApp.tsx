/**
 * AgentApp — the one-component AI agent application.
 *
 * ```tsx
 * import { AgentApp } from '@svton/agent-app';
 *
 * export default function App() {
 *   return (
 *     <AgentApp
 *       providers={[{ type: 'openai', apiKey: 'sk-...', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] }]}
 *     />
 *   );
 * }
 * ```
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserPlatform } from '@svton/agent-platform';
import { AgentProvider, ChatService } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import { AgentShell } from './components/AgentShell';
import { DefaultSettingsAdapter } from './lib/default-settings-adapter';
import { createAgentConfig } from './lib/create-agent-config';
import type { AgentAppProps, ModelOption } from './types';

export function AgentApp(props: AgentAppProps) {
  const {
    providers: propProviders,
    defaultModel,
    systemPrompt,
    workingDir,
    searchEndpoint,
    features,
    skills,
    mcpServers,
    maxIterations,
    contextConfig,
    className,
    title,
    theme = 'dark',
    sidebarConfig,
    sidebarItems,
  } = props;

  const [platform] = useState(() => new BrowserPlatform());
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(defaultModel || '');
  const [refreshKey, setRefreshKey] = useState(0);

  // Build model list from all providers
  const models: ModelOption[] = useMemo(() => {
    return propProviders.flatMap(p =>
      p.models.map(m => ({
        id: m.id,
        name: m.name,
        providerName: p.name || p.type,
        providerType: p.type,
      }))
    );
  }, [propProviders]);

  // Initialize adapter
  const adapter = useMemo(() => new DefaultSettingsAdapter(propProviders), [propProviders]);

  // Initialize agent
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await createAgentConfig({
          providers: propProviders,
          model: currentModel,
          platform,
          features,
          searchEndpoint,
          systemPrompt,
          workingDir,
          skills,
          mcpServers,
          maxIterations,
          contextConfig,
        });

        // Populate agent data for settings
        adapter.setAgentData({
          tools: config.toolRegistry.listDefinitions().map((t: any) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
          skills: (config.capabilities?.skillManager?.list() ?? []).map(s => ({
            name: s.name,
            description: s.description,
          })),
          permissionMode: config.capabilities?.permissionManager?.getMode() || 'default',
          hasMemory: true,
          memoryText: '',
          mcpServers: [],
          hasSubagent: false,
          hasPlanning: !!config.capabilities?.planningManager,
        });
        adapter.onUpdate = () => setRefreshKey(k => k + 1);

        if (!cancelled) {
          setAgentConfig(config);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [platform, currentModel, propProviders, features, searchEndpoint, systemPrompt, workingDir, skills, mcpServers, maxIterations, contextConfig, adapter, refreshKey]);

  // Model change handler
  const handleModelChange = useCallback((model: string) => {
    setCurrentModel(model);
    // Save selection
    localStorage.setItem('svton-app:defaultModel', model);
  }, []);

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-screen bg-[#000000] text-gray-100 font-mono ${className ?? ''}`}>
        <div className="text-center max-w-md">
          <div className="text-red-400 text-sm mb-2">初始化失败</div>
          <div className="text-gray-500 text-xs">{error}</div>
          <div className="text-gray-600 text-xs mt-4">请检查 Provider 配置和 API Key</div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!agentConfig) {
    return (
      <div className={`flex items-center justify-center h-screen bg-[#000000] text-gray-100 font-mono ${className ?? ''}`}>
        <div className="text-gray-500 text-sm">初始化中...</div>
      </div>
    );
  }

  // Ready — render with AgentProvider (creates @svton/service scope)
  return (
    <div className={className} data-theme={theme}>
      <AgentProvider platform={platform} config={agentConfig}>
        <AgentShell
          config={agentConfig}
          models={models}
          currentModel={currentModel}
          onModelChange={handleModelChange}
          adapter={adapter}
          title={title}
          onReinit={() => setRefreshKey(k => k + 1)}
          sidebarConfig={sidebarConfig}
          sidebarItems={sidebarItems}
        />
      </AgentProvider>
    </div>
  );
}
