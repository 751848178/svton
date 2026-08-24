import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const spinnerVariants = cva('rounded-full border-muted-foreground/20 border-t-primary animate-spin', {
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
  /** 延迟显示（ms），避免快速请求的闪烁（默认 0） */
  delay?: number;
  className?: string;
}

function Spinner({ size }: { size?: 'small' | 'default' | 'large' | null }) {
  return <div className={spinnerVariants({ size: size ?? undefined })} />;
}

export function Spin(props: SpinProps) {
  const { spinning = true, size, tip, children, delay = 0, className } = props;
  const [visible, setVisible] = useState(delay === 0 ? spinning : false);
  const timerRef = useRef<number>(undefined);

  useEffect(() => {
    if (delay <= 0) {
      setVisible(spinning);
      return undefined;
    }
    if (spinning) {
      timerRef.current = window.setTimeout(() => setVisible(true), delay);
      return () => window.clearTimeout(timerRef.current);
    }
    setVisible(false);
    return undefined;
  }, [spinning, delay]);

  const spinner = (
    <div className="flex flex-col items-center gap-2">
      <Spinner size={size} />
      {tip && <div className="text-sm text-muted-foreground">{tip}</div>}
    </div>
  );

  if (!children) {
    if (!visible) return null;
    return (
      <div role="status" aria-live="polite" className={className}>
        {spinner}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} aria-busy={spinning || undefined}>
      {children}
      {visible && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/70"
          role="status"
          aria-live="polite"
        >
          {spinner}
        </div>
      )}
    </div>
  );
}
