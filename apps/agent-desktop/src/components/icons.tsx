import type { ElementType } from 'react';
import {
  AgentIcon as AgentLineIcon,
  AutomationIcon as AutomationLineIcon,
  ChatIcon as ChatLineIcon,
  ChevronIcon as ChevronLineIcon,
  ChronicleIcon as ChronicleLineIcon,
  FolderIcon as FolderLineIcon,
  IntegrationIcon as IntegrationLineIcon,
  MoreIcon as MoreLineIcon,
  PluginIcon as PluginLineIcon,
  PlusIcon as PlusLineIcon,
  PopoutIcon as PopoutLineIcon,
  SearchIcon as SearchLineIcon,
  SettingsIcon as SettingsLineIcon,
  SkillIcon as SkillLineIcon,
  ToolboxIcon as ToolboxLineIcon,
  TrashIcon as TrashLineIcon,
  WorktreeIcon as WorktreeLineIcon,
  type SvtonIconProps,
} from '@svton/ui';

function desktopIcon(Icon: ElementType<SvtonIconProps>, size = 14, strokeWidth = 1.5) {
  return function DesktopLineIcon() {
    return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
  };
}

export const PlusIcon = desktopIcon(PlusLineIcon, 14, 2);
export const SearchIcon = desktopIcon(SearchLineIcon);
export const FolderIcon = desktopIcon(FolderLineIcon);
export const GearIcon = desktopIcon(SettingsLineIcon);
export const TrashIcon = desktopIcon(TrashLineIcon, 12, 2);
export const ChatIcon = desktopIcon(ChatLineIcon);
export const AutomationIcon = desktopIcon(AutomationLineIcon);
export const SkillIcon = desktopIcon(SkillLineIcon);
export const PluginIcon = desktopIcon(PluginLineIcon);
export const AgentIcon = desktopIcon(AgentLineIcon);
export const WorktreeIcon = desktopIcon(WorktreeLineIcon);
export const ChronicleIcon = desktopIcon(ChronicleLineIcon);
export const IntegrationIcon = desktopIcon(IntegrationLineIcon);
export const PopoutIcon = desktopIcon(PopoutLineIcon);
export const ChevronIcon = desktopIcon(ChevronLineIcon, 10, 2);
export const MoreIcon = desktopIcon(MoreLineIcon, 12);
export const ToolboxIcon = desktopIcon(ToolboxLineIcon, 14, 2);
