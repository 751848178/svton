import React from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const skeletonVariants = cva('bg-black/5', {
  variants: {
    variant: {
      text: 'rounded',
      circular: 'rounded-full',
      rectangular: 'rounded-none',
      rounded: 'rounded-lg',
    },
    animation: {
      pulse: 'animate-pulse',
      wave: 'animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-black/5 via-black/10 to-black/5 bg-[length:200%_100%]',
      none: '',
    },
  },
  defaultVariants: {
    variant: 'text',
    animation: 'pulse',
  },
});

export interface SkeletonProps extends VariantProps<typeof skeletonVariants> {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton(props: SkeletonProps) {
  const { width = '100%', height = 20, variant, animation, className } = props;

  return (
    <div
      className={cn(skeletonVariants({ variant, animation }), className)}
      style={{
        width: variant === 'circular' ? height : width,
        height,
      }}
    />
  );
}

export interface SkeletonGroupProps {
  count?: number;
  gap?: number;
  children?: React.ReactNode;
  className?: string;
}

export function SkeletonGroup(props: SkeletonGroupProps) {
  const { count = 3, gap = 12, children, className } = props;

  return (
    <div className={cn('flex flex-col', className)} style={{ gap }}>
      {children || Array.from({ length: count }).map((_, i) => <Skeleton key={i} />)}
    </div>
  );
}
