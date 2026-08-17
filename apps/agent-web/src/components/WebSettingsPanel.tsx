import { useEffect, useRef, useState } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type {
  LiveModelRegistry,
} from '@svton/agent-app';
import {
  SettingsView,
  type ExecutionProfileControl,
  type ModelSelectionControl,
  type ReasoningControl,
} from '@svton/agent-ui';
import { BrowserSettingsAdapter } from '@/lib/browser-settings-adapter';
import { useI18n } from '@svton/ui';
import { createBrowserSettingsPresentationCopy } from '@/lib/locale/web-presentation-copy';

interface WebSettingsPanelProps {
  platform: BrowserPlatform;
  config: AgentConfig;
  registry: LiveModelRegistry;
  modelSelection: ModelSelectionControl;
  executionControl: ExecutionProfileControl;
  reasoningControl: ReasoningControl;
  onBack: () => void;
}

export function WebSettingsPanel({
  platform,
  config,
  registry,
  modelSelection,
  executionControl,
  reasoningControl,
  onBack,
}: WebSettingsPanelProps) {
  const { translate: t } = useI18n();
  const bootTranslator = useRef(t).current;
  const [refreshKey, setRefreshKey] = useState(0);
  const [adapter] = useState(() => new BrowserSettingsAdapter(
    platform,
    createBrowserSettingsPresentationCopy(bootTranslator),
    () => setRefreshKey((key) => key + 1),
    registry,
  ));
  useEffect(() => {
    adapter.setAgentConfig(config);
    setRefreshKey((key) => key + 1);
  }, [adapter, config]);
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
