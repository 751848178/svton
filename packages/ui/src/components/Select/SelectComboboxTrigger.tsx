import React from 'react';
import type { RefObject } from 'react';
import { ChevronDownIcon } from '../../icons';
import { cn } from '../../lib/utils';
import { SelectTags } from './SelectTags';
import type { useSelectCombobox } from './useSelectCombobox';

type Model = ReturnType<typeof useSelectCombobox>;

export function SelectComboboxTrigger(props: {
  model: Model;
  triggerRef: RefObject<HTMLDivElement | null>;
  id?: string;
  ariaLabel?: string;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  multiple?: boolean;
  clearable?: boolean;
  loading?: boolean;
  size: 'sm' | 'md';
}) {
  const triggerStyle = cn(
    'w-full rounded-md border border-input bg-background outline-none transition-colors focus-within:ring-2 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
    props.size === 'sm' ? 'min-h-9 px-2 py-1 text-xs' : 'min-h-11 px-3 py-2 text-sm',
    props.invalid && 'border-destructive focus-within:ring-destructive/40',
  );
  const placeholder = props.multiple
    ? props.model.selectedItems.length === 0 ? (props.placeholder ?? '') : ''
    : props.model.search.length === 0
      ? (props.model.selectedItems[0]?.label ?? props.placeholder ?? '')
      : '';
  const spinner = props.loading
    ? <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
    : null;
  const shared = {
    id: props.id,
    'aria-expanded': props.model.open,
    'aria-controls': props.model.open ? props.model.id : undefined,
    'aria-haspopup': 'listbox' as const,
    'aria-activedescendant': props.model.activeDescendant,
    'aria-disabled': props.disabled || undefined,
    'aria-invalid': props.invalid || undefined,
    'aria-label': props.ariaLabel,
    onKeyDown: props.model.handleKeyDown,
  };

  return (
    <div ref={props.triggerRef} className={cn('relative w-full', props.className)} data-svton-select-combobox="">
      {props.model.canSearch ? (
        <div onClick={props.model.openWithInput} className={cn(triggerStyle, 'flex items-center gap-2')}>
          {props.multiple ? <Tags {...props} /> : null}
          <input
            {...shared}
            ref={props.model.inputRef}
            role="combobox"
            aria-autocomplete="list"
            value={props.model.search}
            onChange={props.model.handleInputChange}
            onFocus={props.model.openWithInput}
            placeholder={placeholder}
            disabled={props.disabled}
            className={cn('min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground', props.size === 'sm' ? 'text-xs' : 'text-sm')}
          />
          {spinner}<ChevronDownIcon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </div>
      ) : (
        <div
          {...shared}
          tabIndex={props.disabled ? -1 : 0}
          role="combobox"
          onClick={props.model.toggleOpen}
          className={cn(triggerStyle, 'flex cursor-pointer items-center gap-2 text-left')}
        >
          {props.multiple ? <Tags {...props} /> : props.model.selectedItems[0] ? (
            <span className="flex-1 truncate">{props.model.selectedItems[0].label}</span>
          ) : <span className="flex-1 truncate text-muted-foreground">{props.placeholder}</span>}
          {spinner}<ChevronDownIcon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function Tags(props: Parameters<typeof SelectComboboxTrigger>[0]) {
  return (
    <SelectTags
      items={props.model.selectedItems}
      disabled={props.disabled}
      clearable={props.clearable}
      onRemove={props.model.removeValue}
      onClearAll={props.model.clearAll}
    />
  );
}
