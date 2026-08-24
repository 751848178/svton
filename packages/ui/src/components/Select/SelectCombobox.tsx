import React, { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { SelectOption, SelectOptionFilter } from './types';
import { useSelectCombobox } from './useSelectCombobox';
import { SelectPanel } from './SelectPanel';
import { SelectTags } from './SelectTags';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';
import { ChevronDownIcon } from '../../icons';

interface SelectComboboxProps {
  'aria-label'?: string;
  id?: string;
  options: SelectOption[];
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  onSearch?: (input: string) => void;
  filterOption?: SelectOptionFilter;
  multiple?: boolean;
  value: string | string[] | undefined;
  size?: 'sm' | 'md';
  loading?: boolean;
  clearable?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (value: string | string[]) => void;
  renderOption?: (option: SelectOption, index: number) => React.ReactNode;
  emptyText?: React.ReactNode;
  /** 面板宽度策略（antd 同名语义）：true=等宽触发器+选项省略；false=自适应最宽选项（min-width=触发器） */
  popupMatchSelectWidth?: boolean;
  autoFocus?: boolean;
  /** 面板收起时回调（携带当前值），用于合成 RHF onBlur */
  onCollapseBlur?: (value: string | string[]) => void;
  /** 表单镜像（隐藏原生 select）：承接 name/ref/required 等原生属性，保证 RHF register/表单提交兼容 */
  mirrorProps?: Record<string, unknown>;
}

export function SelectCombobox(props: SelectComboboxProps) {
  const {
    'aria-label': ariaLabel,
    id,
    options,
    className,
    invalid,
    disabled,
    placeholder,
    searchable,
    onSearch,
    filterOption,
    multiple,
    value,
    size = 'md',
    loading,
    clearable,
    open: controlledOpen,
    onOpenChange,
    onChange,
    renderOption,
    emptyText,
    popupMatchSelectWidth = true,
    autoFocus,
    onCollapseBlur,
    mirrorProps,
  } = props;

  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next);
    if (!next) onCollapseBlur?.(value ?? (multiple ? [] : ''));
  };

  const model = useSelectCombobox({
    options,
    value,
    searchable,
    onSearch,
    filterOption,
    multiple,
    open: controlledOpen,
    onOpenChange: handleOpenChange,
    onChange,
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  // 镜像 select 内部持有：非受控（兼容 RHF reset/register），选中变化后回写 value
  const mirrorElementRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  const selectedValues = Array.isArray(value)
    ? value
    : model.selectedItems.map((item) => item.value);

  useEffect(() => {
    const el = mirrorElementRef.current;
    if (!el || multiple) return;
    const next = selectedValues[0] ?? '';
    if (el.value !== next) el.value = next;
  });

  const triggerStyle = cn(
    'w-full rounded-md border border-input bg-background outline-none transition-colors focus-within:ring-2 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
    size === 'sm' ? 'min-h-9 px-2 py-1 text-xs' : 'min-h-11 px-3 py-2 text-sm',
    invalid && 'border-destructive focus-within:ring-destructive/40',
  );

  const triggerRect = triggerRef.current?.getBoundingClientRect();
  const triggerWidth = triggerRect && triggerRect.width > 0 ? triggerRect.width : '100%';
  const panelTop =
    (triggerRect?.bottom ?? 0) + (typeof window !== 'undefined' ? window.scrollY : 0) + 4;
  const panelLeft =
    (triggerRect?.left ?? 0) + (typeof window !== 'undefined' ? window.scrollX : 0);
  // antd 语义：match=true 面板等宽触发器（选项省略）；false 时面板自适应内容，但不窄于触发器、不溢出视口
  const panelStyle: CSSProperties = popupMatchSelectWidth
    ? { top: panelTop, left: panelLeft, width: triggerWidth }
    : {
        top: panelTop,
        left: panelLeft,
        minWidth: triggerWidth,
        width: 'max-content',
        maxWidth:
          typeof window !== 'undefined'
            ? Math.max(triggerRect?.width ?? 0, window.innerWidth - (triggerRect?.left ?? 0) - 16)
            : undefined,
      };

  const spinner = (
    <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
  );

  const inputPlaceholder = multiple
    ? model.selectedItems.length === 0
      ? (placeholder ?? '')
      : ''
    : model.search.length === 0
      ? (model.selectedItems[0]?.label ?? placeholder ?? '')
      : '';

  const panel = (
    <SelectPanel
      id={model.id}
      filtered={model.filtered}
      activeIndex={model.activeIndex}
      multiple={multiple}
      loading={loading}
      emptyText={emptyText}
      renderOption={renderOption}
      onActivate={model.commit}
      onHover={model.setActiveIndex}
      panelRef={model.panelRef}
      style={panelStyle}
      value={{ isSelected: model.isSelected }}
    />
  );


  return (
    <div ref={triggerRef} className={cn('relative w-full', className)} data-svton-select-combobox="">
      {mirrorProps && (
        <select
          {...(mirrorProps as Record<string, unknown>)}
          ref={(node: HTMLSelectElement | null) => {
            mirrorElementRef.current = node;
            const userRef = (mirrorProps as { ref?: unknown }).ref as
              | React.Ref<HTMLSelectElement>
              | undefined;
            if (typeof userRef === 'function') userRef(node);
            else if (userRef && typeof userRef === 'object') {
              (userRef as { current: HTMLSelectElement | null }).current = node;
            }
          }}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          defaultValue=""
          multiple={multiple || undefined}
        >
          <option value="" />
          {model.selectedItems.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      )}
      {model.canSearch ? (
        <div
          onClick={model.openWithInput}
          onKeyDown={model.handleKeyDown}
          aria-invalid={invalid || undefined}
          className={cn(triggerStyle, 'flex items-center gap-2')}
        >
          {multiple && (
            <SelectTags
              items={model.selectedItems}
              disabled={disabled}
              clearable={clearable}
              onRemove={model.removeValue}
              onClearAll={model.clearAll}
            />
          )}
          <input
            ref={model.inputRef}
            role="combobox"
            id={id}
            aria-expanded={model.open}
            aria-controls={model.open ? model.id : undefined}
            aria-haspopup="listbox"
            aria-activedescendant={model.activeDescendant}
            aria-autocomplete="list"
            aria-disabled={disabled || undefined}
            aria-label={ariaLabel}
            value={model.search}
            onChange={model.handleInputChange}
            onFocus={model.openWithInput}
            placeholder={inputPlaceholder}
            disabled={disabled}
            className={cn(
              'min-w-0 flex-1 bg-transparent outline-none',
              size === 'sm' ? 'text-xs' : 'text-sm',
              'placeholder:text-muted-foreground',
            )}
          />
          {loading && spinner}
          <ChevronDownIcon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </div>
      ) : (
        <div
          id={id}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={model.open}
          aria-controls={model.open ? model.id : undefined}
          aria-haspopup="listbox"
          aria-activedescendant={model.activeDescendant}
          aria-disabled={disabled || undefined}
          aria-invalid={invalid || undefined}
          aria-label={ariaLabel}
          onClick={model.toggleOpen}
          onKeyDown={model.handleKeyDown}
          className={cn(triggerStyle, 'flex cursor-pointer items-center gap-2 text-left')}
        >
          {multiple ? (
            <SelectTags
              items={model.selectedItems}
              disabled={disabled}
              clearable={clearable}
              onRemove={model.removeValue}
              onClearAll={model.clearAll}
            />
          ) : model.selectedItems[0] ? (
            <span className="flex-1 truncate">{model.selectedItems[0].label}</span>
          ) : (
            <span className="flex-1 truncate text-muted-foreground">{placeholder}</span>
          )}
          {loading && spinner}
          <ChevronDownIcon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </div>
      )}
      {model.open && <Portal>{panel}</Portal>}
    </div>
  );
}
