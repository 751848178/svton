import React, { useState } from 'react';
import { PlusIcon, cn, useI18n } from '@svton/ui';
import type { ISettingsAdapter } from '../settings-adapter.types';
import type { SkillFormData, SkillInfo } from '../settings-data.types';
import { Badge, Card, Toggle } from '../settings-ui';
import { SkillEditorForm } from './SkillEditorForm';
import { SkillInstallPanel } from './SkillInstallPanel';

export function SkillsListSection({ skills, disabledSkills, hasAgent, onToggle, onAdd, onUpdate, onDelete, onReload, adapter }: {
  skills: SkillInfo[]; disabledSkills: string[]; hasAgent: boolean; onToggle: (name: string) => void;
  onAdd?: (skill: SkillFormData) => void | Promise<void>;
  onUpdate?: (name: string, updates: SkillFormData) => void | Promise<void>;
  onDelete?: (name: string) => void | Promise<void>;
  onReload: () => void; adapter: ISettingsAdapter;
}) {
  const { translate: t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [url, setUrl] = useState(''); const [git, setGit] = useState(''); const [local, setLocal] = useState('');
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const resetEditor = () => { setName(''); setDescription(''); setInstructions(''); setShowAdd(false); setEditingName(null); };
  const save = async () => {
    if (!name.trim()) return;
    const form = { name: name.trim(), description: description.trim(), instructions };
    if (editingName && onUpdate) await onUpdate(editingName, form);
    else if (onAdd) await onAdd(form);
    resetEditor(); onReload();
  };
  const edit = (skill: SkillInfo) => {
    setEditingName(skill.name); setName(skill.name); setDescription(skill.description);
    setInstructions(''); setShowAdd(false);
  };
  const install = async (source: 'url' | 'git' | 'local') => {
    const values = { url, git, local }; const value = values[source].trim();
    const methods = { url: adapter.installSkillFromUrl, git: adapter.installSkillFromGit, local: adapter.installSkillFromLocal };
    const method = methods[source]; if (!method || !value) return;
    setInstalling(true); setStatus(null);
    try {
      const result = await method.call(adapter, value);
      if (!result.success) throw new Error('skill install failed');
      setStatus({ kind: 'success', message: t('settings.skill.installSuccess') });
      if (source === 'url') setUrl(''); else if (source === 'git') setGit(''); else setLocal('');
      onReload();
    } catch {
      setStatus({ kind: 'error', message: t('settings.skill.installFailure', { message: t('status.failed') }) });
    } finally { setInstalling(false); }
  };
  return <div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg text-white font-medium">{t('settings.skill.title')}</h2><p className="text-xs text-gray-500 mt-0.5">{t('settings.skill.description')}</p></div><div className="flex items-center gap-2">{adapter.installSkillFromUrl && !showAdd && !editingName && <button onClick={() => setShowInstall((current) => !current)} className="min-h-11 rounded-lg border border-[#333] px-3 text-[11px] font-medium text-gray-400 hover:border-gray-500 hover:text-white">{t(showInstall ? 'settings.skill.closeInstall' : 'settings.skill.install')}</button>}{onAdd && !showAdd && !editingName && <button onClick={() => { resetEditor(); setShowAdd(true); }} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[#333] px-3 text-[11px] font-medium text-gray-400 hover:border-gray-500 hover:text-white"><PlusIcon size={13} aria-hidden="true" />{t('settings.skill.add')}</button>}</div></div>
    {showInstall && <SkillInstallPanel adapter={adapter} model={{ url, git, local, setUrl, setGit, setLocal, installing, status, install: (source) => void install(source) }} />}
    {(showAdd || editingName) && <SkillEditorForm model={{ editingName, name, description, instructions, setName, setDescription, setInstructions, save: () => void save(), cancel: resetEditor }} />}
    {!hasAgent ? <Card><div className="text-center py-6 text-gray-600 text-sm">{t('settings.skill.noAgent')}</div></Card> : skills.length === 0 ? <Card><div className="text-center py-6 text-gray-600 text-sm">{t('settings.skill.empty')}</div></Card> : <Card className="!p-0 divide-y divide-[#2a2a2a]">{skills.map((skill) => { const disabled = disabledSkills.includes(skill.name); return <div key={skill.name} className={cn('px-4 py-3 flex items-center gap-3 transition-opacity group', disabled && 'opacity-40')}><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><span className="text-sm text-gray-200 font-mono">{skill.name}</span>{skill.scope && <Badge color="blue">{skill.scope}</Badge>}{skill.trigger?.type === 'explicit' && <Badge color="gray">{t('settings.skill.explicit')}</Badge>}{skill.trigger?.type === 'implicit' && <Badge color="yellow">{t('settings.skill.implicit')}</Badge>}</div><div className="text-[11px] text-gray-500 truncate">{skill.description}</div>{skill.requiredTools?.length ? <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-600"><span>{t('settings.skill.dependencies')}</span>{skill.requiredTools.map((tool) => <span key={tool} className="font-mono bg-[#222] px-1 py-0.5 rounded">{tool}</span>)}</div> : null}</div>{onUpdate && <button onClick={() => edit(skill)} className="min-h-11 px-2 text-[11px] text-gray-500 hover:text-cyan-400 focus-visible:text-cyan-400">{t('action.edit')}</button>}{onDelete && <button onClick={async () => { await onDelete(skill.name); onReload(); }} className="min-h-11 px-2 text-[11px] text-gray-500 hover:text-red-400 focus-visible:text-red-400">{t('action.delete')}</button>}<Toggle checked={!disabled} onChange={() => onToggle(skill.name)} label={skill.name} /></div>; })}</Card>}
  </div>;
}
