import React, { ReactNode, useState, useEffect, useCallback, useRef, useId } from 'react';
import { cn } from '../../lib/utils';
import { ClickOutside } from '../ClickOutside';
import { Portal } from '../Portal';
import { useMenuKeyboardNav } from './useMenuKeyboardNav';

/**
 * Dropdown 下拉菜单
 *
 * 点击触发 + 菜单键盘导航（↑↓/Home/End/Enter/Space/Esc）。
 * 单元素 trigger 自动注入 aria-haspopup/aria-expanded/键盘处理器（克隆策略，保留原 onClick）；
 * 纯文本 trigger 退化为 span 按钮。
 */

export interface DropdownProps {
  /** 触发器 */
  trigger: ReactNode;
  /** 菜单内容 */
  children: ReactNode;
  /** 菜单水平对齐（默认 start） */
  align?: 'start' | 'end';
  /** 菜单项激活后是否关闭（默认 true） */
  closeOnSelect?: boolean;
  className?: string;
  /** 受控显隐（可选，否则内部自管） */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type ElementChild = React.ReactElement<Record<string, unknown>>;

function asElementChildren(node: ReactNode): ElementChild[] {
  return React.Children.toArray(node).filter(
    (child): child is ElementChild => React.isValidElement(child),
  );
}

export function Dropdown(props: DropdownProps) {
  const {
    trigger,
    children,
    align = 'start',
    closeOnSelect = true,
    className,
    open: controlledOpen,
    onOpenChange,
  } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const menuId = useId();
  const elementTriggers = asElementChildren(trigger);
  const singleElementTrigger = elementTriggers.length === 1 && elementTriggers[0];
  const fallbackRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const closeAndRestore = useCallback(() => {
    setOpen(false);
    fallbackRef.current?.focus();
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
        ?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleMenuKeyDown = useMenuKeyboardNav({ menuRef, onEscape: closeAndRestore });

  const baseProps = (singleElementTrigger ? singleElementTrigger.props : {}) as {
    onClick?: (e: React.MouseEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
  };
  const triggerProps = {
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (e: React.MouseEvent) => {
      baseProps.onClick?.(e);
      setOpen(!open);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      baseProps.onKeyDown?.(e);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
    },
  };

  return (
    <ClickOutside
      onClickOutside={() => setOpen(false)}
      className={cn('relative inline-block', className)}
    >
      {singleElementTrigger ? (
        React.cloneElement(singleElementTrigger, triggerProps)
      ) : (
        <span
          ref={fallbackRef}
          tabIndex={0}
          role="button"
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...triggerProps}
        >
          {trigger}
        </span>
      )}
      {open && (
        <Portal>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            onKeyDown={handleMenuKeyDown}
            onClick={() => closeOnSelect && setOpen(false)}
            className={cn(
              'absolute z-50 mt-1 min-w-[8rem] rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {children}
          </div>
        </Portal>
      )}
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
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={cn(
        'cursor-pointer rounded-sm px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'pointer-events-none opacity-50',
        danger
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-popover-foreground hover:bg-accent focus-visible:bg-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
