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
import { AgentProvider } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import { AgentShell } from './components/AgentShell';
import { DefaultSettingsAdapter } from './lib/default-settings-adapter';
import { createAgentConfig } from './lib/create-agent-config';
import { createAgentAppStorage } from './lib/storage';
import { buildModelOptions } from './lib/model-selection';
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
    imageProviders,
    settings,
    storage,
    integrations,
    marketplace,
    runtime,
    maxIterations,
    contextConfig,
    className,
    title,
    theme = 'dark',
    sidebarConfig,
    sidebarItems,
  } = props;

  const platform = useMemo(() => new BrowserPlatform({
    storageName: `${storage?.namespace ?? 'svton-app'}:storage`,
  }), [storage?.namespace]);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const appStorage = useMemo(() => createAgentAppStorage(storage?.namespace), [storage?.namespace]);
  const [currentModel, setCurrentModel] = useState(() => {
    if (defaultModel) return defaultModel;
    return createAgentAppStorage(storage?.namespace).getString('defaultModel');
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const settingsKey = JSON.stringify(settings ?? {});
  const integrationsKey = JSON.stringify({
    enabled: integrations?.enabled,
    builtin: integrations?.builtin,
    manifests: integrations?.manifests?.map((manifest) => manifest.id),
  });
  const marketplaceKey = JSON.stringify(marketplace ?? {});

  // Initialize adapter
  const adapter = useMemo(
    () => new DefaultSettingsAdapter(propProviders, platform, settings, storage?.namespace, integrations, marketplace),
    [propProviders, platform, settingsKey, storage?.namespace, integrationsKey, marketplaceKey],
  );

  const runtimeProviders = useMemo(() => adapter.getProviderConfigs(), [adapter, refreshKey]);
  const runtimeMcpServers = useMemo(
    () => [...(mcpServers ?? []), ...adapter.getMcpServerEntries()],
    [adapter, mcpServers, refreshKey],
  );
  const runtimeSearchEndpoint = searchEndpoint ?? adapter.getSearchEndpoint();

  // Build model list from all providers
  const models: ModelOption[] = useMemo(() => {
    return buildModelOptions(runtimeProviders);
  }, [runtimeProviders]);

  useEffect(() => {
    if (!currentModel && models[0]) {
      setCurrentModel(models[0].key);
    }
  }, [currentModel, models]);

  // Initialize agent
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!currentModel && models.length > 0) return;
        const config = await createAgentConfig({
          providers: runtimeProviders,
          model: currentModel,
          platform,
          features,
          searchEndpoint: runtimeSearchEndpoint,
          systemPrompt,
          workingDir,
          skills,
          mcpServers: runtimeMcpServers,
          imageProviders,
          storageNamespace: storage?.namespace,
          integrations,
          marketplace,
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
          hasMemory: !!config.capabilities?.memoryManager,
          memoryText: config.capabilities?.memoryManager?.getAllMemoryText?.() ?? '',
          mcpServers: (config.capabilities?.mcpClients ?? []).map((client: any) => ({
            name: client.info?.name || 'mcp',
            connected: client.connected,
          })),
          hasSubagent: !!config.capabilities?.subagentManager,
          hasPlanning: !!config.capabilities?.planningManager,
        });
        adapter.onUpdate = () => setRefreshKey(k => k + 1);
        adapter.setAgentConfig(config);

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
  }, [platform, currentModel, models.length, runtimeProviders, features, runtimeSearchEndpoint, systemPrompt, workingDir, skills, runtimeMcpServers, imageProviders, storage?.namespace, integrations, marketplace, maxIterations, contextConfig, adapter, refreshKey]);

  // Model change handler
  const handleModelChange = useCallback((model: string) => {
    setCurrentModel(model);
    // Save selection
    appStorage.setString('defaultModel', model);
  }, [appStorage]);

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
      <AgentProvider platform={platform} config={agentConfig} runtimeKey={runtime?.key}>
        <AgentShell
          config={agentConfig}
          models={models}
          currentModel={currentModel}
          onModelChange={handleModelChange}
          adapter={adapter}
          title={title}
          sidebarConfig={sidebarConfig}
          sidebarItems={sidebarItems}
          storageNamespace={storage?.namespace}
        />
      </AgentProvider>
    </div>
  );
}
