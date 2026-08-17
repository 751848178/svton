import React, { useCallback, useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import {
  EXECUTION_PROFILES,
  SessionSettingsControls,
  type ExecutionProfileControl,
  type ReasoningControl,
} from '../chat/SessionSettingsControls';
interface PermissionSettingsSectionProps {
  getPersisted: () => string;
  savePermissionMode: (mode: string) => Promise<void>;
  legacyMode: string;
  setLegacyMode: (mode: string) => void;
  execution?: ExecutionProfileControl;
  reasoning?: ReasoningControl;
  showToast: (message: string) => void;
  showError: (message: string) => void;
}

/** Configured runtime presenter plus awaited unconfigured Settings fallback. */
export function PermissionSettingsSection({
  getPersisted, savePermissionMode, legacyMode, setLegacyMode,
  execution, reasoning, showToast, showError,
}: PermissionSettingsSectionProps) {
  const { translate: t } = useI18n();
  const [pending, setPending] = useState(false);
  const saveLegacy = useCallback(async (mode: string) => {
    if (pending) return;
    setPending(true);
    try {
      await savePermissionMode(mode);
      if (getPersisted() !== mode) throw new Error('permission persistence no-op');
      setLegacyMode(mode);
      showToast(t('settings.permission.updated'));
    } catch {
      showError(t('settings.permission.failure'));
    } finally {
      setPending(false);
    }
  }, [getPersisted, pending, savePermissionMode, setLegacyMode, showError, showToast, t]);

  if (execution && reasoning) {
    return <SessionSettingsControls execution={execution} reasoning={reasoning} layout="settings" />;
  }
  return (
    <div>
      <h2 className="mb-1 text-lg font-medium text-white">{t('settings.execution.title')}</h2>
      <p className="mb-6 text-xs text-gray-500">{t('settings.execution.description')}</p>
      <div className="space-y-2">{EXECUTION_PROFILES.map((profile) => (
        <button
          key={profile.value}
          disabled={pending}
          onClick={() => saveLegacy(profile.value)}
          className={cn(
            'min-h-11 w-full rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            profile.value === legacyMode
              ? 'border-cyan-700 bg-cyan-950/30'
              : 'border-[#383838] bg-[#2a2a2a] hover:border-[#333]',
          )}
        >
          <div className={cn('mb-1 text-sm font-medium', profile.value === legacyMode ? 'text-cyan-300' : 'text-gray-300')}>
            {t(`settings.execution.${profile.value}.label`)}
          </div>
          <p className="text-[11px] text-gray-500">{t(`settings.execution.${profile.value}.description`)}</p>
        </button>
      ))}</div>
      <p className="mt-4 text-[11px] leading-5 text-gray-600">{t('settings.execution.note')}</p>
    </div>
  );
}
