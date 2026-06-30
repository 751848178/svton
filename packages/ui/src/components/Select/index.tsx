import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Select 下拉选择框
 *
 * 原生 <select> 封装，与 Input 同样式基线，不引入第三方。
 */
export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** 选项数组（也可继续用 children <option>） */
  options?: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
}

const baseClass =
  'w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  props,
  ref,
) {
  const { options, placeholder, invalid = false, className, children, ...rest } = props;
  return (
    <select
      ref={ref}
      className={cn(
        baseClass,
        invalid && 'border-red-500 focus:ring-red-500/40',
        className,
      )}
      {...rest}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options
        ? options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
            >
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
});
