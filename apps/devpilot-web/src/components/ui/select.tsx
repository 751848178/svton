/**
 * devpilot Select
 *
 * 原生 <select> 封装，与 devpilot Input/Textarea 同一套约定：
 * 聚焦环走 `ring-primary`（替代 @svton/ui 的 ring-ring），无效态走 destructive token。
 * 复用 @svton/ui 的 SelectOption 类型。
 *
 * 单一职责：下拉选择框样式归一。无业务逻辑。
 */

import React from 'react';
import { cn } from '@/lib/utils';

/** 选项（label/value/disabled），与 @svton/ui SelectOption 结构一致。 */
export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** 选项数组（也可继续用 children <option>）。 */
  options?: SelectOption[];
  placeholder?: string;
  /** 无效态：边框与聚焦环转为 destructive。 */
  invalid?: boolean;
}

const BASE_CLASS =
  'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  props,
  ref,
) {
  const { options, placeholder, invalid = false, className, children, ...rest } = props;
  return (
    <select
      ref={ref}
      className={cn(
        BASE_CLASS,
        invalid && 'border-destructive focus-visible:ring-destructive/40',
        className,
      )}
      {...rest}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
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
