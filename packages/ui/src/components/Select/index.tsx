import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { SelectCombobox } from './SelectCombobox';
import { optionsFromChildren } from './optionsFromChildren';
import type { SelectOption, SelectOptionFilter, SelectChangeEvent, SelectOnChangeValue } from './types';

/**
 * Select 下拉选择框
 *
 * 【默认：自定义渲染】选项面板为 Portal 渲染的 listbox（token 样式、键盘导航、搜索/多选/清空）。
 * 原生 <option> children 会被解析为等价 options（含 optgroup 展平），存量用法零改动迁移；
 * 表单语义通过隐藏镜像 select 兜底（name/ref/required/RHF register）。
 *
 * 【native 逃生门】`native` 显式开启时回到原生 <select> 渲染（系统弹层，移动端原生体验）。
 */

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'onChange'> {
  /** 选项数组（也可继续用 children <option>；两者同给时 options 优先） */
  options?: SelectOption[];
  placeholder?: string;
  /** 无效态：destructive 边框与聚焦环，并透传 aria-invalid */
  invalid?: boolean;
  /** 尺寸：md=表单默认；sm=行内/过滤器 */
  size?: 'sm' | 'md';
  /** 逃生门：强制原生 <select> 渲染（默认 false，走自定义 listbox） */
  native?: boolean;
  // ── 自定义分支增强能力 ──────────────────────────────────────────
  searchable?: boolean;
  onSearch?: (input: string) => void;
  filterOption?: SelectOptionFilter;
  multiple?: boolean;
  clearable?: boolean;
  loading?: boolean;
  emptyText?: React.ReactNode;
  renderOption?: (option: SelectOption, index: number) => React.ReactNode;
  /** 面板宽度策略（antd 同名语义，默认 true）：true=等宽触发器+选项省略号；false=面板自适应最宽选项 */
  popupMatchSelectWidth?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 兼容既有消费方（e.target.value）；自定义分支回传合成事件，形态一致 */
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}

const baseClass =
  'w-full rounded-md border border-input bg-background outline-none transition-colors focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

const sizeClass = {
  md: 'min-h-11 px-3 py-2 text-sm',
  sm: 'min-h-9 px-2 py-1 text-xs',
} as const;

function toChangeEvent(value: SelectOnChangeValue): SelectChangeEvent {
  return { target: { value }, currentTarget: { value } };
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  props,
  ref,
) {
  const {
    options,
    placeholder,
    invalid = false,
    size = 'md',
    className,
    children,
    native = false,
    searchable,
    onSearch,
    filterOption,
    multiple,
    clearable,
    loading,
    emptyText,
    renderOption,
    popupMatchSelectWidth,
    open,
    onOpenChange,
    onChange,
    value,
    disabled,
    autoFocus,
    id,
    ...rest
  } = props;

  const childOptions = useMemo(() => (options ? [] : optionsFromChildren(children)), [options, children]);
  const resolvedOptions = options && options.length > 0 ? options : childOptions;
  const useCustom = !native && resolvedOptions.length > 0;

  const enhancedOnChange = (v: SelectOnChangeValue) => {
    (onChange as unknown as ((event: SelectChangeEvent) => void) | undefined)?.(toChangeEvent(v));
  };

  if (useCustom) {
    const { onBlur, ...mirrorRest } = rest;
    return (
      <SelectCombobox
        aria-label={rest['aria-label']}
        id={id}
        options={resolvedOptions}
        className={className}
        invalid={invalid}
        disabled={disabled}
        placeholder={placeholder}
        searchable={searchable}
        onSearch={onSearch}
        filterOption={filterOption}
        multiple={multiple}
        value={value as string | string[] | undefined}
        size={size}
        loading={loading}
        clearable={clearable}
        open={open}
        onOpenChange={onOpenChange}
        onChange={enhancedOnChange}
        renderOption={renderOption}
        emptyText={emptyText}
        popupMatchSelectWidth={popupMatchSelectWidth}
        autoFocus={autoFocus}
        onCollapseBlur={() => {
          (onBlur as unknown as ((event: SelectChangeEvent) => void) | undefined)?.(
            toChangeEvent(String(value ?? '')),
          );
        }}
        mirrorProps={{ ref, ...mirrorRest }}
      />
    );
  }

  return (
    <select
      ref={ref}
      id={id}
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      className={cn(baseClass, sizeClass[size], invalid && 'border-destructive focus:ring-destructive/40', className)}
      value={value as string | readonly string[] | number | undefined}
      disabled={disabled}
      onChange={onChange}
      {...rest}
    >
      {placeholder ? (
        <option value="" hidden>
          {placeholder}
        </option>
      ) : null}
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
});

export type { SelectOption, SelectOptionFilter, SelectChangeEvent };
