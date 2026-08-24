'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DotsThree } from '@phosphor-icons/react';

export interface ReleaseTableAction {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export function ReleaseOrderActions({
  actions,
  moreLabel,
}: {
  actions: ReleaseTableAction[];
  moreLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const focusOnOpen = useRef<'first' | 'last' | null>(null);
  const restoreTriggerFocus = useRef(false);
  const direct = actions.slice(0, 3);
  const overflow = actions.slice(3);
  const openMenu = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect)
      setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  const closeFromKeyboard = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    restoreTriggerFocus.current = true;
    setOpen(false);
  };
  const enabledItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    );
  const enterMenuFromKeyboard = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || event.shiftKey || !open) return;
    const firstItem = enabledItems()[0];
    if (!firstItem) return;
    event.preventDefault();
    firstItem.focus();
  };
  const moveInsideMenu = (event: React.KeyboardEvent) => {
    const items = enabledItems();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % items.length
            : event.key === 'ArrowUp'
              ? (current - 1 + items.length) % items.length
              : -1;
    if (target < 0) return;
    event.preventDefault();
    items[target]?.focus();
  };
  useEffect(() => {
    if (!open && restoreTriggerFocus.current) {
      restoreTriggerFocus.current = false;
      triggerRef.current?.querySelector('button')?.focus();
      return;
    }
    if (!open || !focusOnOpen.current) return;
    const items = enabledItems();
    const target = focusOnOpen.current === 'last' ? items.at(-1) : items[0];
    focusOnOpen.current = null;
    target?.focus();
  }, [open]);
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      {direct.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onSelect}
          disabled={action.disabled}
          className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {action.label}
        </button>
      ))}
      {overflow.length > 0 ? (
        <div
          ref={triggerRef}
          className="relative"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onBlurCapture={scheduleClose}
          onKeyDown={(event) => {
            closeFromKeyboard(event);
            enterMenuFromKeyboard(event);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              focusOnOpen.current = event.key === 'ArrowUp' ? 'last' : 'first';
              openMenu();
            }
          }}
        >
          {/* 更多操作触发器：与直接操作一致的链接样式（正常字重、无边框底色）。 */}
          <button
            type="button"
            aria-label={moreLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={(event) => {
              if (event.detail === 0) focusOnOpen.current = 'first';
              openMenu();
            }}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded text-xs font-medium text-primary hover:underline"
          >
            <DotsThree
              size={18}
              weight="bold"
              aria-hidden="true"
            />
          </button>
          {open && typeof document !== 'undefined'
            ? createPortal(
                <div
                  ref={menuRef}
                  role="menu"
                  className="fixed z-[1200] min-w-40 rounded-md border bg-popover p-1 shadow-md"
                  style={position}
                  onMouseEnter={openMenu}
                  onMouseLeave={scheduleClose}
                  onFocusCapture={openMenu}
                  onBlurCapture={scheduleClose}
                  onKeyDown={(event) => {
                    closeFromKeyboard(event);
                    moveInsideMenu(event);
                  }}
                >
                  {overflow.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      onClick={() => {
                        setOpen(false);
                        action.onSelect();
                      }}
                      className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : null}
    </div>
  );
}
