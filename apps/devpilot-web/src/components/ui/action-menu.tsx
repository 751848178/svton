/**
 * ActionMenu 操作菜单
 *
 * 零依赖的轻量下拉菜单：useState 管显隐、点击外部关闭、ESC 关闭、
 * button + ul/li role=menu/menuitem 键盘可达。样式全部走 Tailwind token。
 * 用于把一张卡片/面板上平铺的多个低频操作收敛进「⋯」菜单。
 */
'use client';

import { useEffect, useRef, useState } from 'react';

export interface ActionMenuItem {
  key: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionMenuGroup {
  label?: string;
  items: ActionMenuItem[];
}

export function ActionMenu(props: {
  groups: ActionMenuGroup[];
  triggerLabel?: string;
}): JSX.Element {
  const { groups, triggerLabel = '⋯' } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 rounded-md border px-3 text-sm font-medium hover:bg-accent"
      >
        {triggerLabel}
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[10rem] rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {groups.map((group, groupIndex) => (
            <li key={group.label ?? groupIndex} role="none">
              {groupIndex > 0 ? <div role="separator" className="my-1 h-px bg-border" /> : null}
              {group.label ? (
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>
              ) : null}
              <ul role="group" aria-label={group.label}>
                {group.items.map((item) => (
                  <li key={item.key} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        setOpen(false);
                        item.onSelect();
                      }}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                        item.danger ? 'text-destructive hover:bg-destructive/10' : ''
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
