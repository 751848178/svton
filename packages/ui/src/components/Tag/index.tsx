import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { CloseIcon } from '../../icons';
import { useI18n } from '../../i18n';

/**
 * Tag 标签
 *
 * 语义色全部映射到 --svton-ui-status-* token（dark/light 双主题可读），
 * 保留历史 color 名称以兼容既有消费方（default/blue/green/red/orange/purple/cyan）。
 */

type TagColor = 'default' | 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan';

const toneMap: Record<Exclude<TagColor, 'default'>, { text: string; bg: string; border: string }> = {
  blue: { text: 'text-info', bg: 'bg-info/10', border: 'border-info/30' },
  green: { text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  red: { text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
  orange: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  purple: { text: 'text-status-purple', bg: 'bg-status-purple/10', border: 'border-status-purple/30' },
  cyan: { text: 'text-status-cyan', bg: 'bg-status-cyan/10', border: 'border-status-cyan/30' },
} as const;

const tagVariants = cva('inline-flex items-center gap-1 font-medium text-sm leading-5 rounded-md', {
  variants: {
    color: {
      default: 'bg-muted text-foreground border border-border',
      ...Object.fromEntries(Object.entries(toneMap).map(([k, v]) => [k, `${v.text} ${v.bg} ${v.border}`])),
    } as Record<TagColor, string>,
    size: {
      sm: 'px-1.5 py-0 text-xs',
      md: 'px-2 py-0.5',
    },
    bordered: {
      true: '',
      false: 'border-transparent',
    },
    checked: {
      true: 'ring-2 ring-ring/50',
      false: '',
    },
  },
  defaultVariants: {
    color: 'default',
    size: 'md',
    bordered: true,
  },
});

export interface TagProps extends VariantProps<typeof tagVariants> {
  children: ReactNode;
  /** 语义色（兼容历史 raw 色名，内部映射 token） */
  color?: TagColor;
  closable?: boolean;
  onClose?: () => void;
  /** 勾选态（checkable 标签），选中时高亮 */
  checked?: boolean;
  /** 点击回调（勾选/普通交互） */
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function Tag(props: TagProps) {
  const { translate } = useI18n();
  const { children, color, size, bordered, checked, closable = false, onClose, onClick, icon, className } = props;

  return (
    <span
      className={cn(tagVariants({ color, size, bordered, checked: checked || undefined }), className)}
      onClick={onClick}
      role={onClick && !closable ? 'button' : undefined}
      tabIndex={onClick && !closable ? 0 : undefined}
      onKeyDown={
        onClick && !closable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {icon}
      {children}
      {closable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          aria-label={translate('modal.close')}
          className="ml-0.5 inline-flex size-6 items-center justify-center rounded opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CloseIcon size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
