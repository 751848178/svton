import React from 'react';
import type { AgentEditorModel } from './use-agent-editor';
import { FieldLabel, INPUT_CLS, SELECT_CLS } from './settings-ui';
import { useI18n } from '@svton/ui';

const PERMISSION_OPTIONS = [
  'read_only', 'default', 'accept_edits', 'auto',
] as const;
const PRESET_COLORS = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#6b7280'];

export function AgentEditorForm({ model }: { model: AgentEditorModel }) {
  const { translate: t } = useI18n();
  const agent = model.editingAgent;
  if (!agent) return null;
  return (
    <section aria-labelledby="agent-editor-form-heading" className="mb-4 rounded-xl border border-cyan-900/40 bg-[#1c1c1c] p-3 sm:p-5">
      <h3 id="agent-editor-form-heading" className="mb-4 text-sm font-semibold text-cyan-400">{model.isNew ? t('settings.agentEditor.createTitle') : t('settings.agentEditor.editTitle', { name: model.originalName ?? '' })}</h3>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div><FieldLabel htmlFor="agent-name">{t('settings.agentEditor.name')}</FieldLabel><input id="agent-name" value={agent.name} onChange={(event) => model.update('name', event.target.value)} placeholder="my-agent" className={INPUT_CLS} disabled={!model.isNew} /></div>
        <div><FieldLabel htmlFor="agent-title">{t('settings.agentEditor.titleField')}</FieldLabel><input id="agent-title" value={agent.title} onChange={(event) => model.update('title', event.target.value)} placeholder={t('settings.agentEditor.titlePlaceholder')} className={INPUT_CLS} /></div>
      </div>
      <div className="mt-3"><FieldLabel htmlFor="agent-description">{t('settings.agentEditor.descriptionField')}</FieldLabel><input id="agent-description" value={agent.description} onChange={(event) => model.update('description', event.target.value)} placeholder={t('settings.agentEditor.descriptionPlaceholder')} className={INPUT_CLS} /></div>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div><FieldLabel htmlFor="agent-model">{t('settings.agentEditor.model')}</FieldLabel><input id="agent-model" value={agent.model ?? ''} onChange={(event) => model.update('model', event.target.value)} placeholder={t('settings.agentEditor.modelPlaceholder')} className={INPUT_CLS} /></div>
        <div><FieldLabel htmlFor="agent-permission">{t('settings.agentEditor.permission')}</FieldLabel><select id="agent-permission" value={agent.permissions ?? 'default'} onChange={(event) => model.update('permissions', event.target.value)} className={SELECT_CLS}>{PERMISSION_OPTIONS.map((option) => <option key={option} value={option}>{t(`settings.execution.${option}.label`)}</option>)}</select></div>
      </div>
      <div className="mt-3"><FieldLabel htmlFor="agent-system-prompt">{t('settings.agentEditor.systemPrompt')}</FieldLabel><textarea id="agent-system-prompt" value={agent.systemPrompt ?? ''} onChange={(event) => model.update('systemPrompt', event.target.value)} placeholder={t('settings.agentEditor.systemPromptPlaceholder')} className={`${INPUT_CLS} min-h-28 resize-y font-mono text-xs`} /></div>
      <fieldset className="mt-3"><legend className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">{t('settings.agentEditor.color')}</legend><div className="flex flex-wrap gap-2">{PRESET_COLORS.map((color) => <button key={color} type="button" aria-label={t('settings.agentEditor.colorLabel', { color })} aria-pressed={agent.color === color} onClick={() => model.update('color', color)} className="size-11 rounded-md border-2 focus-visible:ring-2 focus-visible:ring-ring" style={{ backgroundColor: color, borderColor: agent.color === color ? '#fff' : 'transparent' }} />)}</div></fieldset>
      <div className="mt-5 flex gap-2"><button type="button" onClick={model.save} disabled={!agent.name.trim()} className="min-h-11 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{t('action.save')}</button><button type="button" onClick={model.cancel} className="min-h-11 rounded-lg border border-[#333] px-4 text-xs text-gray-500">{t('action.cancel')}</button></div>
    </section>
  );
}
