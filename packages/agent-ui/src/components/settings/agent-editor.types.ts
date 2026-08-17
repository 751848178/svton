export interface AgentDefinitionData {
  name: string;
  title: string;
  description: string;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  permissions?: string;
  color?: string;
}

export interface AgentEditorPanelProps {
  agents: AgentDefinitionData[];
  onSave: (agent: AgentDefinitionData) => void;
  onDelete: (name: string) => void;
}
