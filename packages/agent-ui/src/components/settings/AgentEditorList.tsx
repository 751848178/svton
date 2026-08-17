import React from 'react';
import type { AgentDefinitionData } from './agent-editor.types';
import type { AgentEditorModel } from './use-agent-editor';
import { useI18n } from '@svton/ui';

export function AgentEditorList({ agents, model }: { agents: AgentDefinitionData[]; model: AgentEditorModel }) {
  const { translate: t } = useI18n();
  if (agents.length === 0 && !model.editingAgent) return <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] px-4 py-8 text-center text-sm text-gray-500"><p>{t('settings.agentEditor.empty')}</p><p className="mt-1 text-xs">{t('settings.agentEditor.emptyDescription')}</p></div>;
  if (agents.length === 0) return null;
  return (
    <div className="divide-y divide-[#2a2a2a] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1c1c1c]">
      {agents.map((agent) => <div key={agent.name} className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:px-4"><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-gray-200">{agent.name}</p>{agent.title && <p className="truncate text-[11px] text-gray-500">{agent.title}{agent.model && ` · ${agent.model}`}</p>}</div><button type="button" onClick={() => model.edit(agent)} className="min-h-11 px-2 text-[11px] text-gray-500 hover:text-cyan-400 focus-visible:text-cyan-400">{t('settings.agentEditor.edit')}</button><button type="button" onClick={() => model.remove(agent.name)} className="min-h-11 px-2 text-[11px] text-gray-500 hover:text-red-400 focus-visible:text-red-400">{t('settings.agentEditor.delete')}</button></div>)}
    </div>
  );
}
