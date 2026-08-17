import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { CloseIcon } from '../../icons';
import { useI18n } from '../../i18n';

const tagVariants = cva('inline-flex items-center gap-1 px-2 py-0.5 text-xs leading-5 rounded', {
  variants: {
    color: {
      default: 'bg-muted text-slate-700 border border-border',
      blue: 'bg-info/10 text-blue-800 border border-info/30',
      green: 'bg-success/10 text-green-800 border border-success/30',
      red: 'bg-destructive/10 text-red-800 border border-destructive/30',
      orange: 'bg-warning/10 text-orange-800 border border-warning/30',
      purple: 'bg-purple-500/10 text-purple-800 border border-purple-500/30',
      cyan: 'bg-cyan-500/10 text-cyan-800 border border-cyan-500/30',
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
  const { translate } = useI18n();
  const { children, color, bordered, closable = false, onClose, icon, className } = props;

  return (
    <span className={cn(tagVariants({ color, bordered }), className)}>
      {icon}
      {children}
      {closable && (
        <button
          type="button"
          onClick={onClose}
          aria-label={translate('modal.close')}
          className="inline-flex size-6 items-center justify-center rounded opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ml-0.5"
        >
          <CloseIcon size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
