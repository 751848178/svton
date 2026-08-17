import React, { useEffect, useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import { SettingsSwitch } from './SettingsSwitch';

export interface AutoReviewerRule { id: string; description: string; verdict: string }
export interface AutoReviewerSettingsProps {
  mode: 'auto_review' | 'manual';
  rules: AutoReviewerRule[];
  onModeChange: (mode: 'auto_review' | 'manual') => void;
}

function verdictClass(verdict: string) {
  const normalized = verdict.toLowerCase();
  if (normalized.includes('approve') || normalized.includes('allow') || normalized.includes('pass')) return 'bg-green-900/20 text-green-400';
  if (normalized.includes('deny') || normalized.includes('block') || normalized.includes('reject')) return 'bg-red-900/20 text-red-400';
  return 'bg-yellow-900/20 text-yellow-400';
}

export function AutoReviewerSettings({ mode, rules, onModeChange }: AutoReviewerSettingsProps) {
  const { translate: t } = useI18n();
  const [localMode, setLocalMode] = useState(mode);
  useEffect(() => setLocalMode(mode), [mode]);
  const auto = localMode === 'auto_review';
  const toggle = (checked: boolean) => {
    const next = checked ? 'auto_review' : 'manual';
    setLocalMode(next);
    onModeChange(next);
  };
  return (
    <section aria-labelledby="auto-reviewer-heading">
      <h2 id="auto-reviewer-heading" className="text-lg font-medium text-white">{t('settings.reviewer.title')}</h2>
      <p className="mb-6 mt-1 text-xs text-gray-500">{t('settings.reviewer.description')}</p>
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#2a2a2a] bg-[#171717] px-4 py-2"><div><h3 className="text-sm font-medium text-gray-200">{t('settings.reviewer.mode')}</h3><p className="mt-0.5 text-[11px] text-gray-500">{t(auto ? 'settings.reviewer.autoDescription' : 'settings.reviewer.manualDescription')}</p></div><SettingsSwitch checked={auto} onCheckedChange={toggle} label={t('settings.reviewer.mode')} /></div>
        <p className="mb-4 rounded-lg border border-cyan-900/30 bg-cyan-900/10 p-3 text-xs leading-5 text-gray-500">{t(auto ? 'settings.reviewer.autoBody' : 'settings.reviewer.manualBody')}</p>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">{t('settings.reviewer.rules')}</h3>
        {rules.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">{t('settings.reviewer.empty')}</p> : <div className="space-y-2">{rules.map((rule) => <div key={rule.id} className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-[#2a2a2a] bg-[#171717] p-3"><div className="min-w-0 flex-1"><p className="text-xs text-gray-300">{rule.description}</p><p className="mt-1 truncate font-mono text-[10px] text-gray-500">{rule.id}</p></div><span className={cn('shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase', verdictClass(rule.verdict))}>{rule.verdict}</span></div>)}</div>}
      </div>
    </section>
  );
}

export default AutoReviewerSettings;
