import React from 'react';
import type { ExecutionProfileControl, ReasoningControl } from '../chat/SessionSettingsControls';
import type { ModelSelectionControl } from '../models/model-selection.types';
import { AutoReviewerSettings } from './AutoReviewerSettings';
import { IntegrationsPanel } from './IntegrationsPanel';
import { ModelSettingsSection } from './ModelSettingsSection';
import { PermissionSettingsSection } from './PermissionSettingsSection';
import { SandboxSettings } from './SandboxSettings';
import type { ISettingsAdapter } from './settings-adapter.types';
import type { ProviderInfo } from './settings-data.types';
import type { SettingsViewModel } from './use-settings-view-model';
import { AutomationSection } from './sections/AutomationSection';
import { PreviewModeSection } from './sections/PreviewModeSection';
import { GeneralSection } from './sections/GeneralSection';
import { MarketplaceSection } from './sections/MarketplaceSection';
import { McpSection } from './sections/McpSection';
import { MemorySection } from './sections/MemorySection';
import { SearchSection } from './sections/SearchSection';
import { PersonalizationSection, ToolsListSection } from './sections/PersonalizationToolsSections';
import { ProvidersSection } from './sections/ProvidersSection';
import { SkillsListSection } from './sections/SkillsListSection';
import { useI18n } from '@svton/ui';

interface SettingsSectionContentProps {
  adapter: ISettingsAdapter;
  model: SettingsViewModel;
  modelSelection: ModelSelectionControl;
  executionControl?: ExecutionProfileControl;
  reasoningControl?: ReasoningControl;
}

export function SettingsSectionContent({ adapter, model, modelSelection, executionControl, reasoningControl }: SettingsSectionContentProps) {
  const { translate: t } = useI18n();
  const { state, activeSection, showToast } = model;
  const agent = state.agentData;
  if (activeSection === 'general') return <><ModelSettingsSection control={modelSelection} /><GeneralSection workingDir={adapter.getWorkingDir?.()} onWorkingDirChange={adapter.setWorkingDir?.bind(adapter)} storageDescription={adapter.getStorageDescription()} onPersist={model.persist} /></>;
  if (activeSection === 'providers') return <ProvidersSection providers={state.providers} showKey={model.showKey} setShowKey={model.setShowKey} showAddProvider={model.showAddProvider} setShowAddProvider={model.setShowAddProvider} newName={model.newProviderName} setNewName={model.setNewProviderName} newType={model.newProviderType} setNewType={model.setNewProviderType} newUrl={model.newProviderUrl} setNewUrl={model.setNewProviderUrl} onSave={() => model.persist(() => adapter.saveProviders(state.providers), t('settings.feedback.providerSaved'), t('settings.feedback.providerFailure'))} onUpdate={(index, update) => state.setProviders(state.providers.map((provider, candidate) => candidate === index ? { ...provider, ...update } : provider))} onRemove={(index) => state.setProviders(state.providers.filter((_, candidate) => candidate !== index))} onAdd={() => addProvider(model)} hasChanges={model.providersChanged} />;
  if (activeSection === 'personalization') return <PersonalizationSection value={state.customInstructions} onChange={state.setCustomInstructions} onSave={() => { void model.persist(() => adapter.saveCustomInstructions(state.customInstructions), t('settings.feedback.instructionsSaved'), t('settings.feedback.instructionsFailure')); }} />;
  if (activeSection === 'tools') return <ToolsListSection tools={agent?.tools ?? []} disabledTools={state.disabledTools} hasAgent={Boolean(agent)} onToggle={(name) => toggleStored(name, state.disabledTools, state.setDisabledTools, adapter.saveDisabledTools.bind(adapter))} />;
  if (activeSection === 'skills') return <SkillsListSection skills={agent?.skills ?? []} disabledSkills={state.disabledSkills} hasAgent={Boolean(agent)} onToggle={(name) => toggleStored(name, state.disabledSkills, state.setDisabledSkills, adapter.saveDisabledSkills.bind(adapter))} onAdd={adapter.addSkill?.bind(adapter)} onUpdate={adapter.updateSkill?.bind(adapter)} onDelete={adapter.deleteSkill?.bind(adapter)} onReload={state.reload} adapter={adapter} />;
  if (activeSection === 'marketplace') return adapter.searchMarketplace ? <MarketplaceSection adapter={adapter} onReload={state.reload} /> : null;
  if (activeSection === 'mcp') return <McpSection servers={agent?.mcpServers ?? []} configs={adapter.getMcpServerConfigs?.() ?? []} onAdd={adapter.addMcpServer?.bind(adapter)} onRemove={adapter.removeMcpServer?.bind(adapter)} onToggle={adapter.toggleMcpServer?.bind(adapter)} getMcpServerTools={adapter.getMcpServerTools?.bind(adapter)} updateMcpServerToolConfig={adapter.updateMcpServerToolConfig?.bind(adapter)} searchMcpMarketplace={adapter.searchMcpMarketplace?.bind(adapter)} installFromMcpMarketplace={adapter.installFromMcpMarketplace?.bind(adapter)} supportsStdio={Boolean(adapter.getWorkingDir?.())} onReload={state.reload} />;
  if (activeSection === 'permissions') return <PermissionSettingsSection getPersisted={adapter.getPermissionMode.bind(adapter)} savePermissionMode={adapter.savePermissionMode.bind(adapter)} legacyMode={state.permissionMode} setLegacyMode={state.setPermissionMode} execution={executionControl} reasoning={reasoningControl} showToast={showToast} showError={(message) => model.showFeedback('alert', message)} />;
  if (activeSection === 'memory') return agent ? <MemorySection hasMemory={agent.hasMemory} memoryText={agent.memoryText} entries={adapter.getMemoryEntries?.() ?? []} memoryInput={model.memoryInput} setMemoryInput={model.setMemoryInput} onAdd={() => model.persist(async () => { await adapter.addMemory(model.memoryInput); model.setMemoryInput(''); await state.reload(); }, t('settings.feedback.memoryAdded'), t('settings.feedback.memoryAddFailure'))} onClear={() => model.persist(async () => { await adapter.clearMemory(); await state.reload(); }, t('settings.feedback.memoryCleared'), t('settings.feedback.memoryClearFailure'))} onDeleteEntry={(key) => { void model.persist(async () => { await adapter.deleteMemoryEntry?.(key); await state.reload(); }, t('settings.feedback.memoryDeleted'), t('settings.feedback.memoryDeleteFailure')); }} /> : null;
  if (activeSection === 'search') return <SearchSection endpoint={state.searchEndpoint} onChange={state.setSearchEndpoint} onSave={() => { void model.persist(() => adapter.saveSearchEndpoint?.(state.searchEndpoint), t('settings.feedback.searchEndpointSaved'), t('settings.feedback.searchEndpointFailure')); }} apiKey={adapter.getSearchApiKey ? state.searchApiKey : undefined} onApiKeyChange={adapter.getSearchApiKey ? state.setSearchApiKey : undefined} onSaveApiKey={adapter.saveSearchApiKey ? () => { void model.persist(() => adapter.saveSearchApiKey?.(state.searchApiKey), t('settings.feedback.searchKeySaved'), t('settings.feedback.searchKeyFailure')); } : undefined} />;
  if (activeSection === 'automation') return agent ? <AutomationSection hasSubagent={agent.hasSubagent} hasPlanning={agent.hasPlanning} tools={agent.tools} adapter={adapter} /> : null;
  if (activeSection === 'preview') return <PreviewModeSection adapter={adapter} onPersist={model.persist} />;
  if (activeSection === 'sandbox') return <SandboxSettings enabled={adapter.getSandboxConfig?.()?.enabled ?? false} mode={(adapter.getSandboxConfig?.()?.mode as 'read_only' | 'workspace_write' | 'full_access') ?? 'workspace_write'} onChange={(config) => { void model.persist(() => adapter.saveSandboxConfig?.(config), t(config.enabled ? 'settings.feedback.sandboxEnabled' : 'settings.feedback.sandboxDisabled'), t('settings.feedback.sandboxFailure')); }} />;
  if (activeSection === 'auto_reviewer') return <AutoReviewerSettings mode={(adapter.getAutoReviewerConfig?.()?.mode as 'auto_review' | 'manual') ?? 'manual'} rules={adapter.getAutoReviewerConfig?.()?.rules ?? []} onModeChange={(mode) => { void model.persist(() => adapter.saveAutoReviewerMode?.(mode), t(mode === 'auto_review' ? 'settings.feedback.reviewerAuto' : 'settings.feedback.reviewerManual'), t('settings.feedback.reviewerFailure')); }} />;
  return <IntegrationsPanel integrations={adapter.getIntegrations?.() ?? []} onToggle={(id, enabled) => { void model.persist(() => adapter.toggleIntegration?.(id, enabled), t('settings.feedback.integrationSaved'), t('settings.feedback.integrationFailure')); }} onCredentialChange={(id, key, value) => { void model.persist(() => adapter.setIntegrationCredential?.(id, key, value), t('settings.feedback.credentialSaved'), t('settings.feedback.credentialFailure')); }} />;
}

function toggleStored(name: string, current: string[], update: (names: string[]) => void, persist: (names: string[]) => void) {
  const next = current.includes(name) ? current.filter((candidate) => candidate !== name) : [...current, name];
  update(next); persist(next);
}

function addProvider(model: SettingsViewModel) {
  const provider: ProviderInfo = { id: `custom_${Date.now()}`, name: model.newProviderName.trim(), type: model.newProviderType, baseUrl: model.newProviderUrl.trim(), apiKey: '', models: [] };
  model.state.setProviders([...model.state.providers, provider]);
  model.setNewProviderName(''); model.setNewProviderUrl(''); model.setShowAddProvider(false);
}
