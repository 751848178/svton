import React, { useEffect, useRef } from 'react';
import type { SelectOption, SelectOptionFilter } from './types';
import { useSelectCombobox } from './useSelectCombobox';
import { SelectComboboxTrigger } from './SelectComboboxTrigger';
import { SelectPanel } from './SelectPanel';
import { selectPanelPlacement } from './selectPanelPlacement';
import { Portal } from '../Portal';

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

  const panelPlacement = selectPanelPlacement(triggerRef, popupMatchSelectWidth);

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
      style={panelPlacement.style}
      value={{ isSelected: model.isSelected }}
    />
  );


  return (
    <>
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
      <SelectComboboxTrigger
        model={model}
        triggerRef={triggerRef}
        id={id}
        ariaLabel={ariaLabel}
        className={className}
        invalid={invalid}
        disabled={disabled}
        placeholder={placeholder}
        multiple={multiple}
        clearable={clearable}
        loading={loading}
        size={size}
      />
      {model.open && <Portal container={panelPlacement.container}>{panel}</Portal>}
    </>
  );
}
