import { cn, useI18n } from '@svton/ui';
import type { ModelSelectionControl } from './model-selection.types';

interface ModelSelectorProps {
  control: ModelSelectionControl;
  variant?: 'composer' | 'settings';
}

export function ModelSelector({
  control,
  variant = 'composer',
}: ModelSelectorProps) {
  const { translate: t } = useI18n();
  const grouped = groupOptions(control.options);
  const disabled = control.phase === 'committing';
  const isFailure = control.phase === 'failed';
  return (
    <div
      className={cn(
        variant === 'settings'
          ? 'space-y-2'
          : 'order-first flex min-w-0 basis-full flex-wrap items-center gap-2 sm:order-none sm:min-w-0 sm:max-w-[640px] sm:basis-auto sm:flex-1',
      )}
      data-testid={`model-selector-${variant}`}
    >
      <label className={cn(
        variant === 'settings'
          ? 'block text-[11px] uppercase tracking-wider text-gray-500'
          : 'sr-only',
      )} htmlFor={`model-selector-${variant}`}>
        {variant === 'settings'
          ? t('settings.model.defaultAndCurrentLabel')
          : t('settings.model.currentStatus')}
      </label>
      <select
        id={`model-selector-${variant}`}
        aria-describedby={`model-switch-state-${variant}`}
        value={control.activeValue}
        disabled={disabled}
        onChange={(event) => { void control.select(event.target.value); }}
        className={cn(
          'min-h-11 min-w-0 rounded-md border border-[#333] bg-[#222] text-gray-200 outline-none focus:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-60',
          variant === 'settings'
            ? 'w-full px-3 py-2 text-sm'
            : 'w-full px-2 py-1 text-[11px] sm:w-[280px] sm:max-w-full sm:flex-none',
        )}
      >
        {grouped.map(([providerId, options]) => (
          <optgroup
            key={providerId}
            label={`${options[0]?.providerName ?? providerId} (${providerId})`}
          >
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={
                  option.hiddenCurrent
                  || option.removedCurrent
                  || option.value === control.activeValue
                  || (
                    control.phase === 'preparing'
                    && option.value === control.pendingValue
                  )
                }
              >
                {option.accessibleName}
                {option.hiddenCurrent ? t('settings.model.hiddenSuffix') : ''}
                {option.removedCurrent ? t('settings.model.removedSuffix') : ''}
                {option.bootstrap ? t('settings.model.bootstrapSuffix') : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div
        id={`model-switch-state-${variant}`}
        role={isFailure ? 'alert' : 'status'}
        aria-live={isFailure ? 'assertive' : 'polite'}
        className={cn(
          'text-[11px]',
          isFailure ? 'text-red-300' : 'text-gray-500',
          variant === 'composer' && 'min-w-0 basis-full break-words',
        )}
      >
        {control.message ?? control.disabledReason
          ?? t('settings.model.current', { model: control.activeLabel })}
        {control.canRetryPersistence && (
          <button
            type="button"
            className="ml-2 min-h-11 px-2 text-cyan-400 underline hover:text-cyan-300"
            onClick={() => { void control.retryPersistence(); }}
          >
            {t('settings.model.retryPersistence')}
          </button>
        )}
        {(control.phase === 'succeeded' || control.phase === 'failed') && (
          <button
            type="button"
            className="ml-2 min-h-11 px-2 text-gray-400 underline hover:text-gray-200"
            onClick={control.dismissResult}
          >
            {t('action.closeStatus')}
          </button>
        )}
      </div>
    </div>
  );
}

function groupOptions(
  options: readonly ModelSelectionControl['options'][number][],
): Array<[string, typeof options]> {
  const grouped = new Map<string, ModelSelectionControl['options'][number][]>();
  for (const option of options) {
    const items = grouped.get(option.providerId) ?? [];
    items.push(option);
    grouped.set(option.providerId, items);
  }
  return [...grouped.entries()];
}
