import React, { ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';
import { ClickOutside } from '../ClickOutside';
import { Portal } from '../Portal';

/**
 * Dropdown 下拉菜单
 *
 * 基于 ClickOutside + Portal 实现。trigger 点击触发，items 为菜单项。
 * 单一职责：显隐 + 定位 + 点击外部关闭。业务侧用 render 回调自定义菜单内容。
 */
export interface DropdownProps {
  /** 触发器 */
  trigger: ReactNode;
  /** 菜单内容 */
  children: ReactNode;
  /** 菜单水平对齐（默认 start） */
  align?: 'start' | 'end';
  className?: string;
  /** 受控显隐（可选，否则内部自管） */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown(props: DropdownProps) {
  const { trigger, children, align = 'start', className, open: controlledOpen, onOpenChange } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <ClickOutside onClickOutside={() => setOpen(false)} className={cn('relative inline-block', className)}>
      <span onClick={() => setOpen(!open)}>{trigger}</span>
      {open ? (
        <Portal>
          <div
            className={cn(
              'absolute z-50 mt-1 min-w-[8rem] rounded-md border border-border bg-popover text-popover-foreground py-1 shadow-lg',
              align === 'end' ? 'right-0' : 'left-0',
            )}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </Portal>
      ) : null}
    </ClickOutside>
  );
}

/** 菜单项原子（配合 Dropdown 使用）。 */
export interface DropdownItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  danger?: boolean;
}

export function DropdownItem(props: DropdownItemProps) {
  const { disabled = false, danger = false, className, children, ...rest } = props;
  return (
    <div
      role="menuitem"
      className={cn(
        'cursor-pointer px-3 py-1.5 text-sm',
        disabled && 'pointer-events-none opacity-50',
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-popover-foreground hover:bg-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
