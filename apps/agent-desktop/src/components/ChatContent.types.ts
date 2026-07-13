import type { ReactNode } from 'react';
import type { MentionItem, ReasoningEffort, SlashCommand } from '@svton/agent-ui';

export interface ProjectInfo {
  id: string;
  name: string;
}

export interface ChatContentProps {
  modelSelector: ReactNode;
  slashCommands: SlashCommand[];
  matchedSkills: string[];
  onAbort?: () => void;
  permissionMode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';
  onPermissionModeChange: (mode: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto') => void;
  planMode: boolean;
  onPlanModeChange: (enabled: boolean) => void;
  plugins: Array<{ name: string; enabled: boolean }>;
  onPluginToggle: (name: string, enabled: boolean) => void;
  gitBranch?: string | null;
  projectName?: string | null;
  projects?: ProjectInfo[];
  currentProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  mentionItems?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => string;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (effort: ReasoningEffort) => void;
  workingDir: string;
}
