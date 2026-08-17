import React from 'react';
import { useI18n } from '@svton/ui';
import { Card, FieldLabel, INPUT_CLS } from '../settings-ui';

export interface SkillEditorState {
  editingName: string | null; name: string; description: string; instructions: string;
  setName: (value: string) => void; setDescription: (value: string) => void;
  setInstructions: (value: string) => void; save: () => void; cancel: () => void;
}

export function SkillEditorForm({ model }: { model: SkillEditorState }) {
  const { translate: t } = useI18n();
  return <Card className="mb-4 !border-cyan-900/50">
    <div className="text-sm text-cyan-400 font-medium mb-3">{model.editingName ? t('settings.skill.editTitle', { name: model.editingName }) : t('settings.skill.addTitle')}</div>
    <div className="space-y-3"><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"><div><FieldLabel htmlFor="skill-name">{t('settings.skill.name')}</FieldLabel><input id="skill-name" value={model.name} onChange={(event) => model.setName(event.target.value)} placeholder="my-skill" className={INPUT_CLS} disabled={!!model.editingName} /></div><div><FieldLabel htmlFor="skill-description">{t('settings.skill.descriptionField')}</FieldLabel><input id="skill-description" value={model.description} onChange={(event) => model.setDescription(event.target.value)} placeholder={t('settings.skill.descriptionPlaceholder')} className={INPUT_CLS} /></div></div>
      <div><FieldLabel htmlFor="skill-instructions">{t('settings.skill.instructions')}</FieldLabel><textarea id="skill-instructions" value={model.instructions} onChange={(event) => model.setInstructions(event.target.value)} placeholder={t('settings.skill.instructionsPlaceholder')} className="h-32 w-full resize-none rounded-lg border border-[#383838] bg-[#171717] p-3 text-xs text-gray-300 outline-none placeholder:text-gray-600 focus:border-cyan-600" /></div>
      <div className="flex items-center gap-2"><button onClick={model.save} disabled={!model.name.trim()} className="min-h-11 rounded-lg bg-cyan-600 px-3 text-[11px] font-medium text-white disabled:opacity-50">{t(model.editingName ? 'settings.skill.saveChanges' : 'action.add')}</button><button onClick={model.cancel} className="min-h-11 px-3 text-[11px] text-gray-500 hover:text-gray-300">{t('action.cancel')}</button></div>
    </div>
  </Card>;
}
