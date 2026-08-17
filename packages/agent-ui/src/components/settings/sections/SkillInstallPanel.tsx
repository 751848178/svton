import React from 'react';
import { cn, useI18n } from '@svton/ui';
import type { ISettingsAdapter } from '../settings-adapter.types';
import { Card, FieldLabel, INPUT_CLS } from '../settings-ui';

export interface SkillInstallState {
  url: string; git: string; local: string;
  setUrl: (value: string) => void; setGit: (value: string) => void; setLocal: (value: string) => void;
  installing: boolean; status: { kind: 'success' | 'error'; message: string } | null;
  install: (source: 'url' | 'git' | 'local') => void;
}

export function SkillInstallPanel({ adapter, model }: {
  adapter: ISettingsAdapter; model: SkillInstallState;
}) {
  const { translate: t } = useI18n();
  const advanced = adapter.supportsAdvancedInstall?.() ?? false;
  const rows = [
    { source: 'url' as const, enabled: true, label: t('settings.skill.installUrl'), value: model.url, set: model.setUrl, placeholder: 'https://example.com/SKILL.md', type: 'url' },
    { source: 'git' as const, enabled: advanced && !!adapter.installSkillFromGit, label: t('settings.skill.installGit'), value: model.git, set: model.setGit, placeholder: 'https://github.com/user/skill-repo', type: 'url' },
    { source: 'local' as const, enabled: advanced && !!adapter.installSkillFromLocal, label: t('settings.skill.installLocal'), value: model.local, set: model.setLocal, placeholder: '/path/to/skill-directory', type: 'text' },
  ];
  return <Card className="mb-4 !border-cyan-900/50">
    <div className="text-sm text-cyan-400 font-medium mb-3">{t('settings.skill.installTitle')}</div>
    <div className="space-y-3">{rows.filter((row) => row.enabled).map((row) => <div key={row.source}><FieldLabel htmlFor={`skill-install-${row.source}`}>{row.label}</FieldLabel><div className="flex min-w-0 flex-col gap-2 sm:flex-row"><input id={`skill-install-${row.source}`} type={row.type} value={row.value} onChange={(event) => row.set(event.target.value)} placeholder={row.placeholder} className={cn(INPUT_CLS, 'min-w-0 flex-1')} /><button onClick={() => model.install(row.source)} disabled={model.installing || !row.value.trim()} className="min-h-11 shrink-0 rounded-lg bg-cyan-600 px-3 text-[11px] font-medium text-white disabled:opacity-50">{t('action.install')}</button></div></div>)}
      {model.status && <div role={model.status.kind === 'error' ? 'alert' : 'status'} className={cn('text-[11px] px-3 py-2 rounded-lg', model.status.kind === 'success' ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20')}>{model.status.message}</div>}
    </div>
  </Card>;
}
