import React from 'react';
import { cn } from '@svton/ui';

export interface SettingsSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function SettingsSwitch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className,
}: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span className={cn(
        'relative h-5 w-9 rounded-full border transition-colors',
        checked ? 'border-status-info bg-status-info' : 'border-input bg-muted',
      )}>
        <span className={cn(
          'absolute top-0.5 size-4 rounded-full transition-transform',
          checked ? 'bg-[var(--svton-ui-status-on-color)]' : 'bg-foreground',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )} />
      </span>
    </button>
  );
}
