import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Textarea 多行文本框
 *
 * 与 Input 同一套样式基线，默认 min-h-[80px]。
 * 2026-08-23 升级：size 变体；invalid 走 destructive + aria-invalid。
 */
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** 无效态：destructive 边框与聚焦环，并透传 aria-invalid */
  invalid?: boolean;
  /** 尺寸：md=表单默认；sm=行内紧凑（min-h-16 px-2 py-1 text-xs） */
  size?: 'sm' | 'md';
}

const baseClass =
  'w-full rounded-md border border-input bg-background outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

const sizeClass = {
  md: 'min-h-[80px] px-3 py-2 text-sm',
  sm: 'min-h-16 px-2 py-1 text-xs',
} as const;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(props, ref) {
    const { invalid = false, size = 'md', className, ...rest } = props;
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          baseClass,
          sizeClass[size],
          invalid && 'border-destructive focus:ring-destructive/40',
          className,
        )}
        {...rest}
      />
    );
  },
);
