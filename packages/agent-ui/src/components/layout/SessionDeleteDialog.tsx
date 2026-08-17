import React, { useRef, useState, type RefObject } from 'react';
import { useDialogFocus } from '../use-dialog-focus';
import { useI18n } from '@svton/ui';

export function SessionDeleteDialog({ title, returnFocusRef, onCancel, onConfirm }: {
  title: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { translate: t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useDialogFocus(panelRef, {
    initialFocusSelector: '[data-cancel-delete]',
    restoreFocusRef: returnFocusRef,
    trapFocus: true,
    onEscape: pending ? undefined : onCancel,
  });
  const remove = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onCancel();
    } catch {
      setError(t('session.delete.failure'));
      setPending(false);
    }
  };
  return (
    <div onMouseDown={(event) => event.stopPropagation()} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-session-title" aria-describedby="delete-session-description" onKeyDown={handleKeyDown} className="w-full max-w-sm rounded-lg border border-[#3a3a3a] bg-[#252525] p-4 shadow-xl">
        <h2 id="delete-session-title" className="text-sm font-medium text-gray-100">{t('session.delete.title', { title })}</h2>
        <p id="delete-session-description" className="mt-2 text-xs text-gray-400">{t('session.delete.description')}</p>
        {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button data-cancel-delete type="button" disabled={pending} onClick={onCancel} className="rounded px-3 py-2 text-xs text-gray-400 disabled:opacity-40">{t('action.cancel')}</button>
          <button type="button" disabled={pending} onClick={() => void remove()} className="rounded bg-red-600 px-3 py-2 text-xs text-white disabled:opacity-40">{t(pending ? 'session.delete.deleting' : 'session.manage.command.delete')}</button>
        </div>
      </div>
    </div>
  );
}
