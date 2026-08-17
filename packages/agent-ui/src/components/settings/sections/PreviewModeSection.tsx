import React, { useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import type { ISettingsAdapter } from '../settings-adapter.types';

export function PreviewModeSection({ adapter, onPersist }: {
  adapter: ISettingsAdapter;
  onPersist?: (operation: () => void | Promise<void>, success: string, failure?: string) => Promise<void>;
}) {
  const { translate: t } = useI18n();
  const [mode, setMode] = useState<'sidebar' | 'window'>(adapter.getPreviewMode?.()
    ?? (typeof localStorage !== 'undefined'
      ? (localStorage.getItem('agent:preview_mode') as 'sidebar' | 'window') || 'sidebar'
      : 'sidebar'));
  const handleModeChange = (next: 'sidebar' | 'window') => {
    setMode(next);
    const operation = () => {
      if (adapter.savePreviewMode) adapter.savePreviewMode(next);
      else if (typeof localStorage !== 'undefined') localStorage.setItem('agent:preview_mode', next);
    };
    if (onPersist) void onPersist(operation, t('settings.preview.saved'), t('settings.preview.saveFailure'));
    else operation();
  };
  return <div className="space-y-4">
    <h3 className="text-sm font-medium text-gray-200">{t('settings.preview.title')}</h3>
    <p className="text-xs text-gray-500">{t('settings.preview.description')}</p>
    <fieldset className="space-y-2"><legend className="sr-only">{t('settings.preview.title')}</legend>
      {(['sidebar', 'window'] as const).map((value) => <label key={value} className={cn('flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors', mode === value ? 'border-cyan-600 bg-cyan-900/10' : 'border-[#383838] hover:border-[#3a3a3a]')}><input type="radio" name="preview-mode" checked={mode === value} onChange={() => handleModeChange(value)} className="accent-cyan-500" /><div><div className="text-sm text-gray-200">{t(`settings.preview.${value}`)}</div><div className="text-[11px] text-gray-500">{t(`settings.preview.${value}Description`)}</div></div></label>)}
    </fieldset>
  </div>;
}
