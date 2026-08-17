import React from 'react';
import { AgentEditorForm } from './AgentEditorForm';
import { AgentEditorList } from './AgentEditorList';
import type { AgentEditorPanelProps } from './agent-editor.types';
import { useAgentEditor } from './use-agent-editor';
import { useI18n } from '@svton/ui';

export type { AgentDefinitionData, AgentEditorPanelProps } from './agent-editor.types';

export function AgentEditorPanel({ agents, onSave, onDelete }: AgentEditorPanelProps) {
  const { translate: t } = useI18n();
  const model = useAgentEditor({ onSave, onDelete });
  return (
    <section aria-labelledby="agent-editor-heading">
      <h2 id="agent-editor-heading" className="text-lg font-medium text-white">{t('settings.agentEditor.title')}</h2>
      <p className="mb-4 mt-1 text-xs text-gray-500">{t('settings.agentEditor.description')}</p>
      {!model.editingAgent && <div className="mb-4 flex justify-end"><button type="button" onClick={model.create} className="min-h-11 rounded-lg border border-[#333] bg-[#222] px-3 text-[11px] font-semibold text-gray-300">{t('settings.agentEditor.create')}</button></div>}
      <AgentEditorForm model={model} />
      <AgentEditorList agents={agents} model={model} />
    </section>
  );
}

export default AgentEditorPanel;
