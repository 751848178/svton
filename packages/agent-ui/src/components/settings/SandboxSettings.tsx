import React, { useEffect, useState } from 'react';
import { WarningIcon, cn, useI18n } from '@svton/ui';
import { SettingsSwitch } from './SettingsSwitch';

export interface SandboxSettingsProps {
  enabled: boolean;
  mode: 'read_only' | 'workspace_write' | 'full_access';
  onChange: (config: { enabled: boolean; mode: string }) => void;
}

const MODE_OPTIONS = [
  { id: 'read_only' }, { id: 'workspace_write' }, { id: 'full_access' },
] as const;

export function SandboxSettings({ enabled, mode, onChange }: SandboxSettingsProps) {
  const { translate: t } = useI18n();
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localMode, setLocalMode] = useState(mode);
  useEffect(() => setLocalEnabled(enabled), [enabled]);
  useEffect(() => setLocalMode(mode), [mode]);
  const updateEnabled = (next: boolean) => { setLocalEnabled(next); onChange({ enabled: next, mode: localMode }); };
  const updateMode = (next: typeof mode) => { setLocalMode(next); onChange({ enabled: localEnabled, mode: next }); };
  return (
    <section aria-labelledby="sandbox-heading">
      <h2 id="sandbox-heading" className="text-lg font-medium text-white">{t('settings.sandbox.title')}</h2>
      <p className="mb-6 mt-1 text-xs text-gray-500">{t('settings.sandbox.description')}</p>
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#2a2a2a] bg-[#171717] px-4 py-2">
          <div><h3 className="text-sm font-medium text-gray-200">{t('settings.sandbox.enable')}</h3><p className="mt-0.5 text-[11px] text-gray-500">{t('settings.sandbox.enableDescription')}</p></div>
          <SettingsSwitch checked={localEnabled} onCheckedChange={updateEnabled} label={t('settings.sandbox.enable')} />
        </div>
        <fieldset disabled={!localEnabled} className="space-y-2 disabled:opacity-40">
          <legend className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">{t('settings.sandbox.accessMode')}</legend>
          {MODE_OPTIONS.map((option) => <label key={option.id} className={cn('flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3', localMode === option.id && localEnabled ? 'border-cyan-700 bg-cyan-900/10' : 'border-[#2a2a2a]')}><input type="radio" name="sandbox-mode" value={option.id} checked={localMode === option.id} onChange={() => updateMode(option.id)} className="mt-1 size-4 accent-cyan-500" /><span><span className="block text-sm font-medium text-gray-200">{t(`settings.sandbox.${option.id}.label`)}</span><span className="mt-1 block text-[11px] text-gray-500">{t(`settings.sandbox.${option.id}.description`)}</span></span></label>)}
        </fieldset>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-cyan-900/40 bg-cyan-900/10 p-3"><WarningIcon size={15} className="mt-0.5 shrink-0 text-cyan-400" aria-hidden="true" /><p className="text-[11px] leading-5 text-gray-400">{t('settings.sandbox.warning')}</p></div>
      </div>
    </section>
  );
}

export default SandboxSettings;
