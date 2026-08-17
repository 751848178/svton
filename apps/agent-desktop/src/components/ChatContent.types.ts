import type { ReactNode } from 'react';
import type { MentionItem, SlashCommand } from '@svton/agent-ui';

export interface ProjectInfo {
  id: string;
  name: string;
}

export interface ChatContentProps {
  modelSelector: ReactNode;
  slashCommands: SlashCommand[];
  matchedSkills: string[];
  onAbort?: () => void;
  sessionSettings: ReactNode;
  plugins: Array<{ name: string; enabled: boolean }>;
  onPluginToggle: (name: string, enabled: boolean) => void;
  gitBranch?: string | null;
  projectName?: string | null;
  projects?: ProjectInfo[];
  currentProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  mentionItems?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => string;
  workingDir: string;
}
