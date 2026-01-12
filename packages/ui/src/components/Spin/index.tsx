import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const spinnerVariants = cva('rounded-full border-blue-500/20 border-t-blue-500 animate-spin', {
  variants: {
    size: {
      small: 'size-4 border-2',
      default: 'size-6 border-[3px]',
      large: 'size-8 border-4',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

export interface SpinProps extends VariantProps<typeof spinnerVariants> {
  spinning?: boolean;
  tip?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Spin(props: SpinProps) {
  const { spinning = true, size, tip, children, className } = props;

  const spinner = (
    <div className="flex flex-col items-center gap-2">
      <div className={spinnerVariants({ size })} />
      {tip && <div className="text-sm text-black/60">{tip}</div>}
    </div>
  );

  if (!children) return spinner;

  return (
    <div className={cn('relative', className)}>
      {children}
      {spinning && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
          {spinner}
        </div>
      )}
    </div>
  );
}
