import React, { useRef, useState, type RefObject } from 'react';
import { useDialogFocus } from '../use-dialog-focus';
import { useI18n } from '@svton/ui';

export function SessionRenameDialog({ title, returnFocusRef, onCancel, onSave }: {
  title: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onSave: (title: string) => Promise<boolean>;
}) {
  const { translate: t } = useI18n();
  const [value, setValue] = useState(title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const handleKeyDown = useDialogFocus(panelRef, {
    initialFocusSelector: 'input',
    restoreFocusRef: returnFocusRef,
    trapFocus: true,
    onEscape: pending ? undefined : onCancel,
  });
  const submit = async () => {
    if (pending || !value.trim()) return;
    setPending(true);
    setError(null);
    try {
      if (await onSave(value)) onCancel();
      else setError(t('session.rename.failure'));
    } catch {
      setError(t('session.rename.failure'));
    } finally {
      setPending(false);
    }
  };
  return (
    <div onMouseDown={(event) => event.stopPropagation()} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-session-title"
        onKeyDown={handleKeyDown}
        className="w-full max-w-sm rounded-lg border border-[#3a3a3a] bg-[#252525] p-4 shadow-xl"
        onSubmit={(event) => { event.preventDefault(); void submit(); }}
      >
        <h2 id="rename-session-title" className="text-sm font-medium text-gray-100">{t('session.rename.title')}</h2>
        <label className="mt-3 block text-xs text-gray-400">
          {t('session.rename.field')}
          <input value={value} disabled={pending} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded border border-[#444] bg-[#171717] px-3 py-2 text-sm text-white outline-none" />
        </label>
        {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={onCancel} className="rounded px-3 py-2 text-xs text-gray-400 disabled:opacity-40">{t('action.cancel')}</button>
          <button type="submit" disabled={pending || !value.trim()} className="rounded bg-white px-3 py-2 text-xs text-black disabled:opacity-40">{t(pending ? 'session.rename.saving' : 'action.save')}</button>
        </div>
      </form>
    </div>
  );
}
