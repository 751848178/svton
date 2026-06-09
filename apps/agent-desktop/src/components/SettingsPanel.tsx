import React, { useEffect, useState } from 'react';
import type { TauriPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { SettingsView } from '@svton/agent-ui';
import { loadConfig } from '@/lib/config-store';
import { TauriSettingsAdapter } from '@/lib/tauri-settings-adapter';

interface SettingsPanelProps {
  platform: TauriPlatform;
  agentConfig?: AgentConfig;
  onBack: () => void;
}

export function SettingsPanel({ platform, agentConfig, onBack }: SettingsPanelProps) {
  const [adapter] = useState(() => new TauriSettingsAdapter(platform, agentConfig));
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
    setRefreshKey((k) => k + 1);
  }, [agentConfig, adapter]);

  return (
    <SettingsView
      adapter={adapter}
      onBack={onBack}
      refreshKey={refreshKey}
    />
  );
}
