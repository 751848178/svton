/**
 * devpilot Button
 *
 * Token 驱动（primary/secondary/destructive 等全部走 CSS 变量），并采用 min-h-11
 * 触控目标尺寸。替代散落在各页面里手写的 `bg-primary px-4 py-2 ...` 按钮。
 *
 * 注意：不包装 @svton/ui 的 Button（其 primary 硬编码 bg-blue-600、size 硬编码 h-9，
 * 会把固定调色板带进 devpilot）。此处用本地 buttonVariants 函数（cva 等价签名）构建。
 *
 * 单一职责：按钮样式 + loading。无业务逻辑。
 *
 * 实现注记：spec 原本要求 import cva from 'class-variance-authority'，但该包仅为
 * @svton/ui 的依赖、未被 devpilot-web 直接声明，pnpm 严格 node_modules 下不可解析。
 * 故用等价的本地 buttonVariants 函数实现，保持调用签名
 * `buttonVariants({ variant, size, block })` 与类型导出完全一致。
 */

import React from 'react';
import { cn } from '@/lib/utils';

/** 按钮形态。 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
/** 按钮尺寸。 */
export type ButtonSize = 'sm' | 'md' | 'icon';

/** buttonVariants 的入参（与 cva 的 VariantProps 用法对齐）。 */
export interface ButtonVariantProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const VARIANT_CLASS: Record<NonNullable<ButtonVariant>, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const SIZE_CLASS: Record<NonNullable<ButtonSize>, string> = {
  sm: 'min-h-9 px-3',
  md: 'min-h-11 px-4 py-2',
  icon: 'min-h-11 w-11 p-0',
};

/**
 * 按钮样式工厂（cva 风格签名）。
 * variant 默认 'primary'，size 默认 'md'，block 默认 false。
 */
export function buttonVariants(props: ButtonVariantProps = {}): string {
  const { variant = 'primary', size = 'md', block = false } = props;
  return cn(
    BASE_CLASS,
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    block ? 'w-full' : '',
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  /** 加载态：显示 spinner 并禁用点击。 */
  loading?: boolean;
}

/** devpilot 统一按钮。 */
export function Button(props: ButtonProps) {
  const {
    variant,
    size,
    block,
    loading = false,
    disabled,
    className,
    children,
    ...rest
  } = props;

  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
