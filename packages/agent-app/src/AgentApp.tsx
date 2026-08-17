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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserPlatform } from '@svton/agent-platform';
import { AgentProvider, useStartupTask } from '@svton/agent-client';
import { StartupStateView } from '@svton/agent-ui';
import type { AgentConfig } from '@svton/agent-core';
import { AgentShell } from './components/AgentShell';
import { DefaultSettingsAdapter } from './lib/default-settings-adapter';
import { createAgentAppStorage } from './lib/storage';
import type { AgentAppProps } from './types';
import { initializeAgentAppConfig } from './lib/initialize-agent-app-config';
import {
  LiveModelRegistry,
  providerConfigsToRegistrySources,
} from './models/model-registry';
import { createAgentAppModelSwitchHost } from './models/agent-app-model-switch-host';
import { encodeModelKey } from '@svton/agent-client';

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
  const appStorage = useMemo(() => createAgentAppStorage(storage?.namespace), [storage?.namespace]);
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
  const [modelRegistry] = useState(() => new LiveModelRegistry(
    providerConfigsToRegistrySources(runtimeProviders),
  ));
  useEffect(() => {
    modelRegistry.replace(providerConfigsToRegistrySources(runtimeProviders));
  }, [modelRegistry, runtimeProviders]);
  const storedModel = defaultModel || appStorage.getString('defaultModel');
  const [initialModelKey] = useState(() =>
    modelRegistry.resolve(storedModel)
    ?? modelRegistry.getSnapshot().records.find((record) => !record.hidden)?.key
    ?? null);
  const runtimeMcpServers = useMemo(
    () => [...(mcpServers ?? []), ...adapter.getMcpServerEntries()],
    [adapter, mcpServers, refreshKey],
  );
  const runtimeSearchEndpoint = searchEndpoint ?? adapter.getSearchEndpoint();
  const runtimeSearchApiKey = adapter.getSearchApiKey?.();

  useEffect(() => {
    if (initialModelKey && storedModel !== encodeModelKey(initialModelKey)) {
      appStorage.setString('defaultModel', encodeModelKey(initialModelKey));
    }
  }, [appStorage, initialModelKey, storedModel]);

  const startupModel = initialModelKey ? encodeModelKey(initialModelKey) : '';
  const configOptions = useMemo(() => ({
    providers: runtimeProviders,
    model: startupModel,
    platform,
    features,
    searchEndpoint: runtimeSearchEndpoint,
    searchApiKey: runtimeSearchApiKey,
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
  }), [runtimeProviders, startupModel, platform, features, runtimeSearchEndpoint,
    runtimeSearchApiKey, systemPrompt, workingDir, skills, runtimeMcpServers,
    imageProviders, storage?.namespace, integrations, marketplace, maxIterations,
    contextConfig, refreshKey]);
  const configOptionsRef = useRef(configOptions);
  configOptionsRef.current = configOptions;
  const [modelSwitchHost] = useState(() => initialModelKey
    ? createAgentAppModelSwitchHost(
        platform,
        () => configOptionsRef.current,
        adapter,
        appStorage,
        initialModelKey,
      )
    : null);
  const configStartup = useStartupTask<AgentConfig>({
    source: 'provider',
    generationKey: configOptions,
    load: async () => startupModel
      ? {
          kind: 'ready',
          value: await initializeAgentAppConfig(
            configOptions,
            adapter,
            () => setRefreshKey((key) => key + 1),
          ),
        }
      : { kind: 'noConfiguration', cause: '请先配置 Provider、API Key 和模型。' },
  });

  if (configStartup.state.phase !== 'ready' || !initialModelKey || !modelSwitchHost) {
    return (
      <StartupStateView
        state={configStartup.state}
        onRetry={configStartup.retry}
        className={className}
      />
    );
  }
  const agentConfig = configStartup.state.value;

  // Ready — render with AgentProvider (creates @svton/service scope)
  return (
    <div className={className} data-theme={theme}>
      <AgentProvider
        platform={platform}
        config={agentConfig}
        runtimeKey={runtime?.key}
        modelKey={initialModelKey}
        startupFallback={(startup) => (
          <StartupStateView state={startup.state} onRetry={startup.retry} />
        )}
      >
        <AgentShell
          config={agentConfig}
          modelRegistry={modelRegistry}
          modelSwitchHost={modelSwitchHost}
          initialModelKey={initialModelKey}
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
