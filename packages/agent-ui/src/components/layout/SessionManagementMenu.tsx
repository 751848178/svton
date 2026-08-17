import React, { useState } from 'react';
import { Portal, useI18n } from '@svton/ui';
import type {
  SessionManagementActions,
  SessionManagementCommand,
  SessionManagementModel,
} from './sidebar.types';
import { SessionRenameDialog } from './SessionRenameDialog';
import { SessionDeleteDialog } from './SessionDeleteDialog';
import { useResponsiveSidebarSurface } from './ResponsiveSidebarSurface';
import { useSessionManagementMenu } from './use-session-management-menu';
import { sessionManagementCommandKeys } from './session-management-copy';

export function SessionManagementMenu({ title, model, actions }: {
  title: string;
  model: SessionManagementModel;
  actions: SessionManagementActions;
}) {
  const { translate: t } = useI18n();
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const surface = useResponsiveSidebarSurface();
  const menu = useSessionManagementMenu(model.commands.length);
  const {
    closeMenu, firstItemRef, menuPosition, menuRef, open, openMenu,
    portalContainer, rootRef, toggleMenu, triggerRef,
  } = menu;
  const run = async (command: SessionManagementCommand) => {
    if (pending) return;
    closeMenu();
    setError(null);
    if (command === 'rename' || command === 'delete') {
      setDialog(command);
      return;
    }
    setPending(true);
    try {
      const result = command === 'pin' || command === 'unpin'
        ? await actions.setPinned(model.sessionId, command === 'pin')
        : command === 'archive'
          ? await actions.archive(model.sessionId)
          : command === 'stopAndArchive'
            ? await actions.stopAndArchive(model.sessionId)
            : await actions.unarchive(model.sessionId);
      if (!result.ok) setError(t(result.reason === 'active'
        ? 'session.manage.activeError'
        : 'session.manage.genericError'));
    } catch {
      setError(t('session.manage.genericError'));
    } finally {
      setPending(false);
      triggerRef.current?.focus();
    }
  };
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = current < 0
        ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
        : (current + delta + items.length) % items.length;
      items[next]?.focus();
    }
  };
  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('session.manage.trigger', { title })}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
          }
        }}
        className="min-h-9 rounded px-2 text-[10px] text-gray-500 opacity-70 hover:bg-[#333] hover:text-gray-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-gray-400 group-focus-within:opacity-100 max-lg:min-h-11 max-lg:min-w-11"
      >
        {t(pending ? 'session.manage.processing' : 'session.manage.manage')}
      </button>
      {open && portalContainer && (
        <Portal container={portalContainer}><div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          aria-label={t('session.manage.menuLabel', { title })}
          className={`${surface?.compactSurface ? 'absolute' : 'fixed'} z-[100] w-36 rounded-md border border-[#3a3a3a] bg-[#252525] p-1 shadow-xl`}
          style={menuPosition}
        >
          {model.commands.map((command, index) => (
            <button
              ref={index === 0 ? firstItemRef : undefined}
              autoFocus={index === 0}
              key={command}
              type="button"
              role="menuitem"
              onClick={() => void run(command)}
              className={`block min-h-9 w-full rounded px-2 text-left text-[11px] hover:bg-[#333] max-lg:min-h-11 ${command === 'delete' ? 'text-red-400' : 'text-gray-300'}`}
            >
              {t(sessionManagementCommandKeys[command])}
            </button>
          ))}
        </div></Portal>
      )}
      {error && <span role="alert" className="absolute right-0 top-full z-40 mt-1 w-44 rounded bg-red-950 px-2 py-1 text-[10px] text-red-300">{error}</span>}
      {dialog === 'rename' && (
        <SessionRenameDialog
          title={title}
          returnFocusRef={triggerRef}
          onCancel={() => setDialog(null)}
          onSave={async (value) => (await actions.rename(model.sessionId, value)).ok}
        />
      )}
      {dialog === 'delete' && (
        <SessionDeleteDialog
          title={title}
          returnFocusRef={triggerRef}
          onCancel={() => setDialog(null)}
          onConfirm={() => actions.deletePermanently(model.sessionId)}
        />
      )}
    </div>
  );
}
