import React, { useEffect, useState } from 'react';
import { FileIcon, FolderIcon, useI18n } from '@svton/ui';
import { Card, FieldLabel, INPUT_CLS } from '../settings-ui';

export function GeneralSection({ workingDir, onWorkingDirChange, storageDescription, onPersist }: {
  workingDir?: string;
  onWorkingDirChange?: (dir: string) => void | Promise<void>;
  storageDescription: string;
  onPersist?: (operation: () => void | Promise<void>, success: string) => Promise<void>;
}) {
  const { translate: t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [directory, setDirectory] = useState(workingDir || '');
  useEffect(() => setDirectory(workingDir || ''), [workingDir]);
  const save = async () => {
    const next = directory.trim();
    if (next && next !== workingDir && onWorkingDirChange) {
      const operation = () => onWorkingDirChange(next);
      if (onPersist) await onPersist(operation, t('settings.feedback.workingDirectorySaved'));
      else await operation();
    }
    setEditing(false);
  };
  return (
    <section aria-labelledby="general-settings-heading">
      <h2 id="general-settings-heading" className="text-lg font-medium text-white">{t('settings.general.title')}</h2>
      <p className="mb-6 mt-1 text-xs text-gray-500">{t('settings.general.description')}</p>
      {workingDir && <Card className="mb-6"><h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-200"><FolderIcon size={16} aria-hidden="true" />{t('settings.general.workingDirectory')}</h3>{editing ? <div className="space-y-2"><FieldLabel htmlFor="settings-working-directory">{t('settings.general.workingDirectoryPath')}</FieldLabel><input id="settings-working-directory" value={directory} onChange={(event) => setDirectory(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(); if (event.key === 'Escape') setEditing(false); }} className={INPUT_CLS} autoFocus /><div className="flex gap-2"><button onClick={() => void save()} className="min-h-11 rounded-lg bg-cyan-600 px-3 text-[11px] font-medium text-white">{t('action.save')}</button><button onClick={() => setEditing(false)} className="min-h-11 px-3 text-[11px] text-gray-500">{t('action.cancel')}</button></div></div> : <div className="flex min-w-0 flex-col gap-2 sm:flex-row"><p className="min-w-0 flex-1 truncate rounded-lg border border-[#383838] bg-[#171717] px-3 py-2 font-mono text-sm text-gray-400">{workingDir}</p>{onWorkingDirChange && <button onClick={() => setEditing(true)} className="min-h-11 shrink-0 rounded-lg border border-[#333] bg-[#222] px-3 text-[11px] font-medium text-gray-400">{t('settings.general.modify')}</button>}</div>}<p className="mt-1 text-[10px] text-gray-600">{t('settings.general.workingDirectoryHelp')}</p></Card>}
      <Card><h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-200"><FileIcon size={16} aria-hidden="true" />{t('settings.general.storage')}</h3><p className="text-[11px] text-gray-500">{storageDescription}</p></Card>
    </section>
  );
}
