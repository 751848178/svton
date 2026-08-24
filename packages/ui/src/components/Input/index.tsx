import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Input 文本输入框
 *
 * 统一历史 INPUT_CLASS：'w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
 * 2026-08-23 升级：新增 size 变体（sm=行内紧凑）；invalid 走 destructive token 并透传 aria-invalid
 * （消费方 tailwind 主题需含 destructive 色；devpilot-web 已含）。
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 无效态：destructive 边框与聚焦环，并透传 aria-invalid */
  invalid?: boolean;
  /** 尺寸：md=表单默认（min-h-11）；sm=行内/过滤器（min-h-9 px-2 py-1 text-xs） */
  size?: 'sm' | 'md';
}

const baseClass =
  'w-full rounded-md border border-input bg-background outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

const sizeClass = {
  md: 'min-h-11 px-3 py-2 text-sm',
  sm: 'min-h-9 px-2 py-1 text-xs',
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  props,
  ref,
) {
  const { invalid = false, size = 'md', className, ...rest } = props;
  return (
    <input
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
});

/** 暴露历史命名的样式常量，便于逐步迁移裸 input 时复用。 */
export const INPUT_CLASS = baseClass;
