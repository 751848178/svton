import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * Button 按钮
 *
 * 统一的按钮原语，消除业务侧裸 <button> 重复样式（primary/secondary/outline/ghost/link）。
 * 设计上与历史用法对齐：primary = blue-600 实心；outline = blue-600 描边。
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
        outline: 'border border-primary text-primary hover:bg-primary/10',
        ghost: 'text-foreground hover:bg-accent',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline px-0 py-0',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4 py-2',
        lg: 'h-10 px-5 text-base',
        icon: 'h-9 w-9 p-0',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 加载态（显示 spinner 并禁用点击） */
  loading?: boolean;
}

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
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export { buttonVariants };
