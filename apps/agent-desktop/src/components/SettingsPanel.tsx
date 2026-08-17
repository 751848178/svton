import React, { useEffect, useState } from 'react';
import type { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import type { AgentExtra } from '@/lib/agent-setup';
import {
  SettingsView,
  type ExecutionProfileControl,
  type ModelSelectionControl,
  type ReasoningControl,
} from '@svton/agent-ui';
import type { LiveModelRegistry } from '@svton/agent-app';
import { loadConfig } from '@/lib/config-store';
import { TauriSettingsAdapter } from '@/lib/tauri-settings-adapter';

interface SettingsPanelProps {
  platform: TauriPlatform;
  agentConfig?: AgentConfig;
  extra?: AgentExtra;
  onBack: () => void;
  onReinit?: (workingDir?: string) => void;
  registry?: LiveModelRegistry;
  modelSelection?: ModelSelectionControl;
  executionControl?: ExecutionProfileControl;
  reasoningControl?: ReasoningControl;
}

export function SettingsPanel({
  platform,
  agentConfig,
  extra,
  onBack,
  onReinit,
  registry,
  modelSelection,
  executionControl,
  reasoningControl,
}: SettingsPanelProps) {
  const [adapter] = useState(() => new TauriSettingsAdapter(platform, agentConfig, () => {
    setRefreshKey((k) => k + 1);
  }, onReinit, registry));
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadConfig(platform).then((result) => {
      if (result.config) {
        adapter.setConfig(result.config);
        setRefreshKey((k) => k + 1);
      }
    });
  }, [platform, adapter]);

  useEffect(() => {
    adapter.setAgentConfig(agentConfig);
    if (extra?.integrationManager) {
      adapter.setIntegrationManager(extra.integrationManager);
    }
    setRefreshKey((k) => k + 1);
  }, [agentConfig, adapter, extra]);

  return (
    <SettingsView
      adapter={adapter}
      modelSelection={modelSelection}
      executionControl={executionControl}
      reasoningControl={reasoningControl}
      onBack={onBack}
      refreshKey={refreshKey}
    />
  );
}
