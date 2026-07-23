import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const tagVariants = cva('inline-flex items-center gap-1 px-2 py-0.5 text-xs leading-5 rounded', {
  variants: {
    color: {
      default: 'bg-muted text-muted-foreground border border-border',
      blue: 'bg-info/10 text-info border border-info/30',
      green: 'bg-success/10 text-success border border-success/30',
      red: 'bg-destructive/10 text-destructive border border-destructive/30',
      orange: 'bg-warning/10 text-warning border border-warning/30',
      purple: 'bg-purple-500/10 text-purple-500 border border-purple-500/30',
      cyan: 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/30',
    },
    bordered: {
      true: '',
      false: 'border-transparent',
    },
  },
  defaultVariants: {
    color: 'default',
    bordered: true,
  },
});

export interface TagProps extends VariantProps<typeof tagVariants> {
  children: ReactNode;
  closable?: boolean;
  onClose?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function Tag(props: TagProps) {
  const { children, color, bordered, closable = false, onClose, icon, className } = props;

  return (
    <span className={cn(tagVariants({ color, bordered }), className)}>
      {icon}
      {children}
      {closable && (
        <span onClick={onClose} className="cursor-pointer opacity-60 hover:opacity-100 text-[10px] ml-0.5">×</span>
      )}
    </span>
  );
}
