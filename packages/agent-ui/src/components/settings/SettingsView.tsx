import React from 'react';
import type { ExecutionProfileControl, ReasoningControl } from '../chat/SessionSettingsControls';
import type { ModelSelectionControl } from '../models/model-selection.types';
import { SettingsSectionContent } from './SettingsSectionContent';
import { SettingsShell } from './SettingsShell';
import type { ISettingsAdapter } from './settings-adapter.types';
import { useLegacyModelSelection } from './use-legacy-model-selection';
import { useSettingsViewModel } from './use-settings-view-model';

export type { ISettingsAdapter, AgentData } from './settings-adapter.types';
export type {
  McpServerConfig,
  McpServerInfo,
  MemoryEntry,
  MarketplaceSkill,
  ProviderInfo,
  SkillFormData,
  SkillInfo,
  ToolInfo,
} from './settings-data.types';

export interface SettingsViewProps {
  adapter: ISettingsAdapter;
  onBack: () => void;
  refreshKey?: number;
  modelSelection?: ModelSelectionControl;
  executionControl?: ExecutionProfileControl;
  reasoningControl?: ReasoningControl;
}

export function SettingsView({
  adapter,
  onBack,
  refreshKey = 0,
  modelSelection,
  executionControl,
  reasoningControl,
}: SettingsViewProps) {
  const model = useSettingsViewModel(adapter, refreshKey);
  const legacyModelSelection = useLegacyModelSelection(
    adapter,
    model.state.providers,
    model.state.defaultModel,
    model.state.setDefaultModel,
  );
  return (
    <SettingsShell
      adapter={adapter}
      sections={model.sections}
      activeSection={model.activeSection}
      onSectionChange={model.setActiveSection}
      onBack={onBack}
      status={model.feedback ? <div role={model.feedback.kind} className={model.feedback.kind === 'alert' ? 'fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-200 shadow-lg' : 'fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-cyan-900 px-4 py-2 text-sm text-cyan-100 shadow-lg'}>{model.feedback.message}</div> : null}
    >
      <SettingsSectionContent
        adapter={adapter}
        model={model}
        modelSelection={modelSelection ?? legacyModelSelection}
        executionControl={executionControl}
        reasoningControl={reasoningControl}
      />
    </SettingsShell>
  );
}
