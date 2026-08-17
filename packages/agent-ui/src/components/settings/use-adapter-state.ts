import { useCallback, useEffect, useState } from 'react';
import type { ISettingsAdapter, AgentData } from './settings-adapter.types';

export function useAdapterState(adapter: ISettingsAdapter, refreshKey: number) {
  // Local mutable state, synced from adapter on mount and when refreshKey changes
  const [providers, setProviders] = useState(() => adapter.getProviders());
  const [defaultModel, setDefaultModel] = useState(() => adapter.getDefaultModel());
  const [agentData, setAgentData] = useState<AgentData | null>(() => adapter.getAgentData());
  const [customInstructions, setCustomInstructions] = useState(() => adapter.getCustomInstructions());
  const [permissionMode, setPermissionMode] = useState(() => adapter.getPermissionMode());
  const [disabledTools, setDisabledTools] = useState(() => adapter.getDisabledTools());
  const [disabledSkills, setDisabledSkills] = useState(() => adapter.getDisabledSkills());
  const [searchEndpoint, setSearchEndpoint] = useState(() => adapter.getSearchEndpoint?.() ?? '');
  const [searchApiKey, setSearchApiKey] = useState(() => adapter.getSearchApiKey?.() ?? '');

  // Re-read all state from adapter when refreshKey changes
  useEffect(() => {
    setProviders(adapter.getProviders());
    setDefaultModel(adapter.getDefaultModel());
    setAgentData(adapter.getAgentData());
    setCustomInstructions(adapter.getCustomInstructions());
    setPermissionMode(adapter.getPermissionMode());
    setDisabledTools(adapter.getDisabledTools());
    setDisabledSkills(adapter.getDisabledSkills());
    setSearchEndpoint(adapter.getSearchEndpoint?.() ?? '');
    setSearchApiKey(adapter.getSearchApiKey?.() ?? '');
  }, [adapter, refreshKey]);

  const reload = useCallback(async () => {
    await adapter.reloadAgent();
    setAgentData(adapter.getAgentData());
    setProviders(adapter.getProviders());
    setDefaultModel(adapter.getDefaultModel());
  }, [adapter]);

  return {
    providers, defaultModel, agentData, customInstructions, permissionMode,
    disabledTools, disabledSkills, searchEndpoint, searchApiKey,
    setProviders, setDefaultModel, setAgentData, setCustomInstructions,
    setPermissionMode, setDisabledTools, setDisabledSkills, setSearchEndpoint, setSearchApiKey,
    reload,
  };
}
