import React from 'react';
import {
  AgentIcon,
  AutomationIcon,
  ChronicleIcon,
  FileIcon,
  IntegrationIcon,
  PlanIcon,
  PluginIcon,
  SearchIcon,
  SettingsIcon,
  SkillIcon,
  ToolboxIcon,
  WorktreeIcon,
  type Translator,
} from '@svton/ui';
import type { ISettingsAdapter } from './settings-adapter.types';

export type SettingsSectionId =
  | 'general' | 'providers' | 'personalization' | 'tools' | 'skills'
  | 'marketplace' | 'mcp' | 'integrations' | 'permissions' | 'preview'
  | 'memory' | 'search' | 'automation' | 'sandbox' | 'auto_reviewer';

export interface SettingsSectionDef { id: SettingsSectionId; label: string; group: string }

const BASE_SECTIONS = [
  ['general', 'personal'], ['providers', 'personal'], ['personalization', 'personal'],
  ['tools', 'integrations'], ['skills', 'integrations'], ['marketplace', 'integrations'],
  ['mcp', 'integrations'], ['integrations', 'integrations'], ['permissions', 'coding'],
  ['preview', 'coding'], ['memory', 'coding'], ['automation', 'coding'],
  ['sandbox', 'coding'], ['auto_reviewer', 'coding'],
] as const;

const iconProps = { size: 14, strokeWidth: 1.5, 'aria-hidden': true } as const;
const ICONS: Record<SettingsSectionId, React.ReactNode> = {
  general: <SettingsIcon {...iconProps} />,
  providers: <PluginIcon {...iconProps} />,
  personalization: <AgentIcon {...iconProps} />,
  tools: <ToolboxIcon {...iconProps} />,
  skills: <SkillIcon {...iconProps} />,
  marketplace: <AutomationIcon {...iconProps} />,
  mcp: <PlanIcon {...iconProps} />,
  integrations: <IntegrationIcon {...iconProps} />,
  permissions: <WorktreeIcon {...iconProps} />,
  preview: <FileIcon {...iconProps} />,
  memory: <ChronicleIcon {...iconProps} />,
  search: <SearchIcon {...iconProps} />,
  automation: <AutomationIcon {...iconProps} />,
  sandbox: <WorktreeIcon {...iconProps} />,
  auto_reviewer: <PlanIcon {...iconProps} />,
};

export function getSettingsSections(adapter: ISettingsAdapter, t: Translator) {
  const sections: SettingsSectionDef[] = BASE_SECTIONS.map(([id, group]) => ({
    id,
    label: t(`settings.navigation.section.${id}`),
    group: t(`settings.navigation.group.${group}`),
  }));
  if (adapter.getSearchEndpoint || adapter.getSearchApiKey) {
    sections.splice(10, 0, {
      id: 'search',
      label: t('settings.navigation.section.search'),
      group: t('settings.navigation.group.coding'),
    });
  }
  return sections;
}

export function SettingsNavigationIcon({ id }: { id: SettingsSectionId }) {
  return <>{ICONS[id]}</>;
}
