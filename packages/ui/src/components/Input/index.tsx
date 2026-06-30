import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Input 文本输入框
 *
 * 统一历史 INPUT_CLASS：
 *   'w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 无效态（红色边框） */
  invalid?: boolean;
}

const baseClass =
  'w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors placeholder:text-black/40 focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  props,
  ref,
) {
  const { invalid = false, className, ...rest } = props;
  return (
    <input
      ref={ref}
      className={cn(baseClass, invalid && 'border-red-500 focus:ring-red-500/40', className)}
      {...rest}
    />
  );
});

/** 暴露历史命名的样式常量，便于逐步迁移裸 input 时复用。 */
export const INPUT_CLASS = baseClass;
