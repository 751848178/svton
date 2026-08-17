import type React from 'react';
import { useI18n } from '@svton/ui';
import { ComposerAttachMenu } from './ComposerAttachMenu';
import type { ComposerController } from './use-composer-controller';

export function ComposerActions({
  controller,
  disabled,
  isStreaming,
  canAbort,
  leadingSlot,
  trailingSlot,
}: {
  controller: ComposerController;
  disabled?: boolean;
  isStreaming?: boolean;
  canAbort: boolean;
  leadingSlot?: React.ReactNode;
  trailingSlot?: React.ReactNode;
}) {
  const { translate: t } = useI18n();
  return (
    <div data-composer-actions className="flex flex-wrap items-end gap-2 px-3 pb-3">
      <div data-composer-control-group className="order-1 flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <ComposerAttachMenu
          disabled={disabled || controller.pending}
          onImages={(files) => void controller.addImages(files)}
          onFile={() => void controller.pickFile()}
        />
        {leadingSlot}
      </div>
      <div data-composer-submit-group className="order-2 ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {isStreaming && canAbort ? (
          <button
            type="button"
            onClick={() => void controller.dispatch({ id: controller.operationId(), kind: 'turn.stop' })}
            className="h-11 min-w-11 rounded-lg bg-red-600 px-3 text-xs text-white hover:bg-red-700"
            aria-label={t('chat.stopGeneration')}
            title={t('chat.stop')}
            data-testid="stop-button"
          >
            {t('chat.stop')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void controller.sendDraft()}
            disabled={disabled || controller.pending || (!controller.value.trim() && !controller.attachments.length)}
            className="h-11 min-w-11 rounded-lg bg-[#333] px-3 text-xs text-gray-200 transition-colors hover:bg-[#444] disabled:cursor-not-allowed disabled:opacity-30"
            data-testid="send-button"
          >
            {t('chat.send')}
          </button>
        )}
        {trailingSlot}
      </div>
    </div>
  );
}
