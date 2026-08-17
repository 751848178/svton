import { useState } from 'react';
import type { AgentDefinitionData, AgentEditorPanelProps } from './agent-editor.types';

const EMPTY_FORM: AgentDefinitionData = {
  name: '', title: '', description: '', model: '', systemPrompt: '', tools: [],
  permissions: 'default', color: '#06b6d4',
};

export function useAgentEditor({ onSave, onDelete }: Pick<AgentEditorPanelProps, 'onSave' | 'onDelete'>) {
  const [editingAgent, setEditingAgent] = useState<AgentDefinitionData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const cancel = () => { setEditingAgent(null); setIsNew(false); setOriginalName(null); };
  const create = () => { setEditingAgent({ ...EMPTY_FORM }); setIsNew(true); setOriginalName(null); };
  const edit = (agent: AgentDefinitionData) => { setEditingAgent({ ...agent }); setIsNew(false); setOriginalName(agent.name); };
  const save = () => {
    if (!editingAgent?.name.trim()) return;
    onSave(editingAgent);
    cancel();
  };
  const remove = (name: string) => { onDelete(name); if (originalName === name) cancel(); };
  const update = <Key extends keyof AgentDefinitionData>(key: Key, value: AgentDefinitionData[Key]) => {
    setEditingAgent((current) => current ? { ...current, [key]: value } : current);
  };
  return { editingAgent, isNew, originalName, create, edit, save, remove, update, cancel };
}

export type AgentEditorModel = ReturnType<typeof useAgentEditor>;
