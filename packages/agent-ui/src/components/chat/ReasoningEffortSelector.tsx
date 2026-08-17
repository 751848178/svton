import React from 'react';
import { useI18n } from '@svton/ui';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | undefined;

export interface ReasoningEffortSelectorProps {
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
  availableEfforts?: readonly Exclude<ReasoningEffort, undefined>[];
  defaultEffort?: Exclude<ReasoningEffort, undefined>;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

/** Native, capability-driven selector shared by composer and Settings. */
export const ReasoningEffortSelector: React.FC<ReasoningEffortSelectorProps> = ({
  value,
  onChange,
  availableEfforts = [],
  defaultEffort,
  disabled = false,
  disabledReason,
  className,
}) => {
  const { translate: t } = useI18n();
  const options = availableEfforts.filter((effort, index) =>
    availableEfforts.indexOf(effort) === index);
  const unavailableCurrent = value !== undefined && !options.includes(value);
  const label = (effort: Exclude<ReasoningEffort, undefined>) =>
    t(`settings.reasoning.${effort}`);
  return (
    <label className={`inline-flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <span className="sr-only">{t('settings.reasoning.title')}</span>
      <select
        aria-label={t('settings.reasoning.title')}
        title={disabledReason ?? t('settings.reasoning.title')}
        value={value ?? 'auto'}
        disabled={disabled}
        onChange={(event) => onChange(parseEffort(event.target.value))}
        className="min-h-11 min-w-[112px] rounded-md border border-[#383838] bg-[#1c1c1c] px-3 text-xs text-gray-300 outline-none focus:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="auto">
          {defaultEffort
            ? t('settings.reasoning.autoDefault', { effort: label(defaultEffort) })
            : t('settings.reasoning.auto')}
        </option>
        {unavailableCurrent && (
          <option value={value} disabled>
            {t('settings.reasoning.currentUnavailable', { effort: label(value) })}
          </option>
        )}
        {options.map((effort) => (
          <option key={effort} value={effort}>{label(effort)}</option>
        ))}
      </select>
    </label>
  );
};

function parseEffort(value: string): ReasoningEffort {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh'
    ? value
    : undefined;
}
