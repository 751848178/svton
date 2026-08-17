import { useId, useRef, type RefObject } from 'react';
import { useI18n } from '@svton/ui';
import { useDialogFocus } from '../use-dialog-focus';
import type { ArtifactConfirmation } from './artifact.types';

export function ArtifactDirtyDialog({ confirmation, returnFocusRef, onCancel, onDiscard }: {
  confirmation: ArtifactConfirmation;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  const { translate: t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const handleKeyDown = useDialogFocus(panelRef, {
    initialFocusSelector: '[data-artifact-dialog-cancel]',
    restoreFocusRef: returnFocusRef,
    trapFocus: true,
    onEscape: onCancel,
  });

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-sm rounded-xl border border-[#454545] bg-[#242424] p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-sm font-medium text-gray-100">{t('artifact.dirty.title')}</h2>
        <p id={descriptionId} className="mt-2 text-xs leading-5 text-gray-400">
          {confirmation.kind === 'replace'
            ? t('artifact.dirty.replaceDescription')
            : t('artifact.dirty.closeDescription')}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button data-artifact-dialog-cancel type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-[#454545] px-4 text-xs text-gray-200 hover:bg-[#303030]">
            {t('artifact.dirty.continue')}
          </button>
          <button type="button" onClick={onDiscard} className="min-h-11 rounded-lg bg-red-700 px-4 text-xs text-white hover:bg-red-600">
            {t('artifact.dirty.discard')}
          </button>
        </div>
      </div>
    </div>
  );
}
