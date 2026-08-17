import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '@svton/ui';

export function ComposerAttachMenu({ disabled, onImages, onFile }: {
  disabled?: boolean;
  onImages: (files: File[]) => void;
  onFile: () => void;
}) {
  const { translate: t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => { if (open) firstItemRef.current?.focus(); }, [open]);

  const closeAndRestore = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { event.preventDefault(); closeAndRestore(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = event.key === 'ArrowDown'
      ? (current + 1) % items.length
      : (current <= 0 ? items.length : current) - 1;
    items[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) onImages(Array.from(event.target.files));
          event.target.value = '';
          setOpen(false);
        }}
      />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('chat.attachment.add')}
        title={t('chat.attachment.referenceTitle')}
        className="flex min-h-11 items-center justify-center rounded-lg px-3 text-xs text-gray-400 transition-colors hover:bg-[#333] hover:text-gray-200 disabled:opacity-30"
      >
        {t('chat.attachment.title')}
      </button>
      {open && (
        <div role="menu" aria-label={t('chat.attachment.menu')} onKeyDown={handleMenuKey} className="absolute bottom-full left-0 z-[60] mb-1 w-44 rounded-lg border border-[#383838] bg-[#2a2a2a] py-1 shadow-xl">
          <button
            ref={firstItemRef}
            role="menuitem"
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="min-h-10 w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#333]"
          >
            {t('chat.attachment.uploadImage')}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => { closeAndRestore(); onFile(); }}
            className="min-h-10 w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#333]"
          >
            {t('chat.attachment.referenceFile')}
          </button>
        </div>
      )}
    </div>
  );
}
