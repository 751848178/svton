import type React from 'react';
import { cn, useI18n } from '@svton/ui';
import { ComposerAttachments } from './ComposerAttachments';
import { MentionPopup, SlashCommandPopup } from './ComposerPopups';
import { ComposerStatus } from './ComposerStatus';
import type { ComposerController } from './use-composer-controller';

export function ComposerSurface({
  controller,
  disabled,
  placeholder,
  className,
  actions,
}: {
  controller: ComposerController;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  actions: React.ReactNode;
}) {
  const { translate: t } = useI18n();
  return (
    <div
      ref={controller.containerRef}
      data-testid="composer-surface"
      aria-busy={controller.pending || undefined}
      onDragOver={(event) => { event.preventDefault(); controller.setDragOver(true); }}
      onDragLeave={(event) => { event.preventDefault(); controller.setDragOver(false); }}
      onDrop={(event) => {
        event.preventDefault();
        controller.setDragOver(false);
        void controller.addImages(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        'relative mb-4 shrink-0 rounded-2xl border bg-[#2a2a2a] shadow-md transition-shadow',
        controller.dragOver
          ? 'border-blue-400 ring-2 ring-blue-200'
          : controller.focused ? 'border-[#4a4a4a] shadow-lg' : 'border-[#383838]',
        disabled && 'opacity-60',
        className,
      )}
    >
      <SlashCommandPopup
        id={controller.commandPopupId}
        itemId={controller.commandItemId}
        commands={controller.commands}
        selected={controller.selectedCommand}
        position={controller.popupPosition}
        onSelect={(command) => void controller.executeCommand(command)}
        onHover={controller.setSelectedCommand}
      />
      <MentionPopup
        id={controller.mentionPopupId}
        itemId={controller.mentionItemId}
        items={controller.mentions}
        selected={controller.selectedMention}
        position={controller.popupPosition}
        onSelect={controller.addMention}
        onHover={controller.setSelectedMention}
      />
      <div className="flex items-end gap-2 px-4 pb-2 pt-3">
        <label htmlFor={controller.textareaId} className="sr-only">{t('chat.composer.inputLabel')}</label>
        <textarea
          ref={controller.textareaRef}
          id={controller.textareaId}
          value={controller.value}
          onChange={(event) => controller.setDraftValue(event.target.value)}
          onKeyDown={controller.onKeyDown}
          onInput={(event) => {
            const element = event.currentTarget;
            element.style.height = 'auto';
            element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
          }}
          onFocus={() => controller.setFocused(true)}
          onBlur={() => controller.setFocused(false)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData?.items ?? []).flatMap((item) => {
              const file = item.type.startsWith('image/') ? item.getAsFile() : null;
              return file ? [file] : [];
            });
            if (files.length) void controller.addImages(files);
          }}
          disabled={disabled}
          placeholder={placeholder ?? t('chat.inputPlaceholder')}
          rows={1}
          data-testid="chat-input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={Boolean(controller.commands.length || controller.mentions.length)}
          aria-controls={controller.commands.length
            ? controller.commandPopupId
            : controller.mentions.length ? controller.mentionPopupId : undefined}
          aria-activedescendant={controller.commands.length
            ? controller.commandItemId(controller.selectedCommand)
            : controller.mentions.length ? controller.mentionItemId(controller.selectedMention) : undefined}
          className="max-h-[200px] min-w-0 flex-1 resize-none bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      <ComposerAttachments
        attachments={controller.attachments}
        onRemove={(id) => controller.setAttachments((items) => items.filter((item) => item.id !== id))}
      />
      <ComposerStatus result={controller.displayedResult} pending={controller.pending} />
      {actions}
    </div>
  );
}
