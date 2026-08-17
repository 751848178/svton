import React from 'react';
import { useI18n } from '@svton/ui';
import { ReasoningEffortSelector, type ReasoningEffort } from './ReasoningEffortSelector';

export type ExecutionProfile = 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';
export type SessionSettingPhase = 'idle' | 'applying' | 'persisting' | 'succeeded' | 'failed';

export interface ExecutionProfileControl {
  value?: ExecutionProfile;
  phase: SessionSettingPhase;
  message?: string;
  disabledReason?: string;
  select: (value: ExecutionProfile) => void | Promise<void>;
}

export interface ReasoningControl {
  value: ReasoningEffort;
  availableEfforts: readonly Exclude<ReasoningEffort, undefined>[];
  defaultEffort?: Exclude<ReasoningEffort, undefined>;
  phase: SessionSettingPhase;
  message?: string;
  disabledReason?: string;
  select: (value: ReasoningEffort) => void | Promise<void>;
}

export interface SessionSettingsControlsProps {
  execution: ExecutionProfileControl;
  reasoning: ReasoningControl;
  layout?: 'compact' | 'settings';
  className?: string;
}

export const EXECUTION_PROFILES: ReadonlyArray<{ value: ExecutionProfile }> = [
  { value: 'read_only' }, { value: 'plan' }, { value: 'default' },
  { value: 'accept_edits' }, { value: 'auto' },
];

export function SessionSettingsControls({
  execution, reasoning, layout = 'compact', className,
}: SessionSettingsControlsProps) {
  const { translate: t } = useI18n();
  const executionPending = execution.phase === 'applying' || execution.phase === 'persisting';
  const reasoningPending = reasoning.phase === 'applying' || reasoning.phase === 'persisting';
  const selected = EXECUTION_PROFILES.find((profile) => profile.value === execution.value);
  return (
    <div className={`${layout === 'compact' ? 'relative flex min-w-0 flex-wrap items-center gap-2' : 'space-y-5'} ${className ?? ''}`}>
      <div className={layout === 'settings' ? 'space-y-2' : ''}>
        <label className="inline-flex min-w-0 flex-col gap-1">
          <span className={layout === 'settings' ? 'text-sm font-medium text-gray-200' : 'sr-only'}>
            {t('settings.execution.title')}
          </span>
          <select
            aria-label={t('settings.execution.title')}
            value={execution.value ?? ''}
            disabled={!execution.value || executionPending || !!execution.disabledReason}
            title={execution.disabledReason ?? t('settings.execution.title')}
            onChange={(event) => {
              const value = parseExecutionProfile(event.target.value);
              if (value) void execution.select(value);
            }}
            className="min-h-11 min-w-[136px] rounded-md border border-[#383838] bg-[#1c1c1c] px-3 text-xs text-gray-300 outline-none focus:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!execution.value && <option value="">{t('settings.execution.unsupported')}</option>}
            {EXECUTION_PROFILES.map((profile) => (
              <option key={profile.value} value={profile.value}>
                {t(`settings.execution.${profile.value}.label`)}
              </option>
            ))}
          </select>
        </label>
        {layout === 'settings' && selected && (
          <p className="max-w-xl text-xs leading-5 text-gray-500">
            {t(`settings.execution.${selected.value}.description`)}
          </p>
        )}
      </div>
      <div className={layout === 'settings' ? 'space-y-2' : ''}>
        {layout === 'settings' && <div className="text-sm font-medium text-gray-200">{t('settings.reasoning.title')}</div>}
        <ReasoningEffortSelector
          value={reasoning.value}
          availableEfforts={reasoning.availableEfforts}
          defaultEffort={reasoning.defaultEffort}
          disabled={reasoningPending || !!reasoning.disabledReason}
          disabledReason={reasoning.disabledReason}
          onChange={(value) => void reasoning.select(value)}
        />
      </div>
      {layout === 'settings' && (
        <p className="max-w-xl text-[11px] leading-5 text-gray-600">
          {t('settings.execution.note')}
        </p>
      )}
      {(execution.message || reasoning.message) && (
        <div className={layout === 'compact'
          ? 'absolute bottom-full right-0 z-40 mb-1 min-w-[280px] space-y-1 rounded-md border border-[#383838] bg-[#1c1c1c] p-2 shadow-lg'
          : 'space-y-1'}>
          {execution.message && (
            <div
              aria-live="polite"
              role={execution.phase === 'failed' ? 'alert' : 'status'}
              className={execution.phase === 'failed' ? 'text-[11px] text-red-400' : 'text-[11px] text-gray-500'}
            >
              {execution.message}
            </div>
          )}
          {reasoning.message && (
            <div
              aria-live="polite"
              role={reasoning.phase === 'failed' ? 'alert' : 'status'}
              className={reasoning.phase === 'failed' ? 'text-[11px] text-red-400' : 'text-[11px] text-gray-500'}
            >
              {reasoning.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseExecutionProfile(value: string): ExecutionProfile | null {
  return value === 'read_only' || value === 'plan' || value === 'default'
    || value === 'accept_edits' || value === 'auto'
    ? value
    : null;
}
