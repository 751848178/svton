import React from 'react';
import { CompletedIcon, PendingIcon, TrashIcon, useI18n } from '@svton/ui';
import type { MemoryEntry } from '../settings-data.types';
import { Card, FieldLabel } from '../settings-ui';

export function MemorySection({ hasMemory, memoryText, entries, memoryInput, setMemoryInput, onAdd, onClear, onDeleteEntry }: {
  hasMemory: boolean;
  memoryText: string;
  entries: MemoryEntry[];
  memoryInput: string;
  setMemoryInput: (value: string) => void;
  onAdd: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onDeleteEntry: (key: string) => void;
}) {
  const { formatDateTime, translate: t } = useI18n();
  return (
    <section aria-labelledby="memory-settings-heading">
      <h2 id="memory-settings-heading" className="text-lg font-medium text-white">{t('settings.memory.title')}</h2>
      <p className="mb-6 mt-1 text-xs text-gray-500">{t('settings.memory.description')}</p>
      {entries.length > 0 && <Card className="mb-4 divide-y divide-[#2a2a2a] !p-0">{entries.map((entry) => <div key={entry.key} className="group flex min-w-0 items-start gap-2 px-4 py-2"><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-xs text-gray-300">{entry.content}</p><p className="mt-1 text-[10px] text-gray-600">{entry.source}{entry.timestamp ? ` · ${formatDateTime(entry.timestamp)}` : ''}</p></div><button aria-label={t('settings.memory.delete', { key: entry.key })} onClick={() => onDeleteEntry(entry.key)} className="inline-flex size-11 shrink-0 items-center justify-center text-gray-500 hover:text-red-400 focus-visible:text-red-400"><TrashIcon size={14} aria-hidden="true" /></button></div>)}</Card>}
      <Card>
        <div className="mb-4 flex items-center gap-2">{hasMemory ? <CompletedIcon size={15} className="text-green-400" aria-hidden="true" /> : <PendingIcon size={15} className="text-gray-600" aria-hidden="true" />}<span className={hasMemory ? 'text-sm text-green-400' : 'text-sm text-gray-500'}>{t(hasMemory ? 'settings.memory.enabled' : 'settings.memory.empty')}</span></div>
        {memoryText && <p className="mb-3 line-clamp-3 text-[11px] text-gray-500">{memoryText}</p>}
        <FieldLabel htmlFor="new-memory">{t('settings.memory.addLabel')}</FieldLabel><textarea id="new-memory" value={memoryInput} onChange={(event) => setMemoryInput(event.target.value)} placeholder={t('settings.memory.placeholder')} className="h-24 w-full resize-none rounded-lg border border-[#383838] bg-[#171717] p-3 text-xs text-gray-300 outline-none placeholder:text-gray-600 focus:border-cyan-600" />
        <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => void onAdd()} disabled={!memoryInput.trim()} className="min-h-11 rounded-lg bg-cyan-600 px-3 text-[11px] font-medium text-white disabled:opacity-50">{t('settings.memory.add')}</button>{hasMemory && <button onClick={() => void onClear()} className="min-h-11 rounded-lg border border-red-900 px-3 text-[11px] font-medium text-red-400 hover:bg-red-900/30">{t('settings.memory.clear')}</button>}</div>
      </Card>
    </section>
  );
}
