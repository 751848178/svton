import { useCallback, useId, useRef, useState } from 'react';
import { useI18n } from '@svton/ui';
import type { ChatInputProps } from './chat-input.types';
import { getMentionContext } from './composer-selection.utils';
import { orderMentionItems } from './ComposerPopups';
import { readComposerImages } from './read-composer-images';
import { useComposerHistory } from './use-composer-history';
import { useComposerKeyboard } from './use-composer-keyboard';
import { useComposerLegacyDispatch } from './use-composer-legacy-dispatch';
import { useComposerPopupPosition } from './use-composer-popup-position';
import {
  MAX_COMPOSER_IMAGES,
  type ComposerAttachment,
  type MentionItem,
  type SlashCommand,
} from './composer.types';

/** Sole local draft coordinator; typed interactions remain owned by the host controller. */
export function useComposerController(props: ChatInputProps) {
  const { translate: t } = useI18n();
  const {
    interaction, onSend, onAbort, onFileReference, onMentionSelect,
    slashCommands = [], mentionItems = [], inputHistory = [], disabled,
  } = props;
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState(0);
  const [selectedMention, setSelectedMention] = useState(0);
  const [dismissedPopup, setDismissedPopup] = useState<'commands' | 'mentions' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupBaseId = useId().replace(/:/g, '');
  const textareaId = `${popupBaseId}-input`;
  const commandPopupId = `${popupBaseId}-commands`;
  const mentionPopupId = `${popupBaseId}-mentions`;
  const commandItemId = useCallback((index: number) => `${commandPopupId}-${index}`, [commandPopupId]);
  const mentionItemId = useCallback((index: number) => `${mentionPopupId}-${index}`, [mentionPopupId]);
  const history = useComposerHistory(value, setValue, inputHistory, textareaRef);
  const { dispatch, localResult, operationId, setLocalResult } = useComposerLegacyDispatch({
    interaction, onSend, onAbort, onFileReference, slashCommands,
  });
  const commandQuery = value.startsWith('/') ? value.slice(1).split(/\s/)[0].toLowerCase() : '';
  const commands = value.startsWith('/') && dismissedPopup !== 'commands'
    ? slashCommands.filter((command) => command.name.startsWith(commandQuery)) : [];
  const mentionContext = getMentionContext(value, textareaRef.current?.selectionStart ?? value.length);
  const mentions = mentionContext.active && dismissedPopup !== 'mentions'
    ? orderMentionItems(mentionItems.filter((item) => item.label.toLowerCase().includes(mentionContext.query))) : [];
  const popupPosition = useComposerPopupPosition(
    containerRef,
    Boolean(commands.length || mentions.length),
    `${focused}:${value}`,
  );

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);
  const clearDraft = useCallback(() => {
    setValue('');
    setAttachments([]);
    history.reset();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [history]);
  const executeCommand = useCallback(async (command: SlashCommand) => {
    const args = value.trim().slice(command.name.length + 1).trim();
    const result = await dispatch({
      id: operationId(), kind: 'slash.execute', commandId: command.id ?? command.name, args,
    });
    if (result.kind === 'succeeded') clearDraft();
    else setLocalResult(result);
    focusInput();
  }, [clearDraft, dispatch, focusInput, operationId, setLocalResult, value]);
  const sendDraft = useCallback(async () => {
    const text = value.trim();
    if ((!text && !attachments.length) || disabled) return;
    if (text.startsWith('/')) {
      const commandName = text.slice(1).split(/\s/)[0];
      const exact = slashCommands.find((command) => command.name === commandName);
      if (exact) return executeCommand(exact);
      const result = await dispatch({
        id: operationId(), kind: 'slash.execute', commandId: commandName,
        args: text.slice(commandName.length + 1).trim(),
      });
      setLocalResult(result);
      return;
    }
    const result = await dispatch({
      id: operationId(), kind: 'turn.send', draft: { text, attachments },
    });
    if (result.kind === 'succeeded') clearDraft();
    else setLocalResult(result);
  }, [attachments, clearDraft, disabled, dispatch, executeCommand, operationId, setLocalResult, slashCommands, value]);
  const addMention = useCallback((item: MentionItem) => {
    if (item.id && item.name && item.path && item.category) {
      const attachment: ComposerAttachment = item.category === 'skill'
        ? { id: item.id, kind: 'skill', name: item.name, path: item.path }
        : { id: item.id, kind: 'mention', name: item.name, path: item.path, mentionType: item.category };
      setAttachments((current) => current.some((entry) => entry.id === attachment.id)
        ? current : [...current, attachment]);
    }
    const inserted = onMentionSelect?.(item) ?? `@${item.label}`;
    setValue(value.slice(0, mentionContext.start) + inserted + ' ' + value.slice(mentionContext.end));
    focusInput();
  }, [focusInput, mentionContext.end, mentionContext.start, onMentionSelect, value]);
  const addImages = useCallback(async (files: File[]) => {
    if (disabled) {
      setLocalResult({
        id: operationId(), kind: 'failed', retryable: true,
        message: t('chat.composer.image.inputUnavailable'),
      });
      return;
    }
    const count = attachments.filter((item) => item.kind === 'image').length;
    const read = await readComposerImages(files, MAX_COMPOSER_IMAGES - count, operationId(), t);
    if (read.error) setLocalResult(read.error);
    else setAttachments((current) => [...current, ...read.attachments]);
  }, [attachments, disabled, operationId, setLocalResult, t]);
  const pickFile = useCallback(async () => {
    const result = await dispatch({ id: operationId(), kind: 'draft.file.pick' });
    if (result.kind === 'succeeded' && result.attachment) {
      setAttachments((current) => current.some((item) => item.id === result.attachment!.id)
        ? current : [...current, result.attachment!]);
      focusInput();
    } else if (result.kind !== 'cancelled') setLocalResult(result);
  }, [dispatch, focusInput, operationId, setLocalResult]);
  const onKeyDown = useComposerKeyboard({
    value, commands, mentions, selectedCommand, selectedMention,
    setSelectedCommand, setSelectedMention, executeCommand, addMention, sendDraft, history,
    dismiss: setDismissedPopup,
  });
  const setDraftValue = useCallback((next: string) => {
    setValue(next);
    history.reset();
    setDismissedPopup(null);
    setSelectedCommand(0);
    setSelectedMention(0);
  }, [history]);

  return {
    value, attachments, focused, dragOver, selectedCommand, selectedMention,
    commands, mentions, popupPosition, textareaRef, containerRef,
    textareaId, commandPopupId, mentionPopupId, commandItemId, mentionItemId,
    displayedResult: localResult ?? interaction?.result ?? null,
    pending: interaction?.pending ?? false,
    setFocused, setDragOver, setSelectedCommand, setSelectedMention,
    setDraftValue, setAttachments, addImages, addMention, executeCommand,
    pickFile, sendDraft, dispatch, operationId, onKeyDown,
  };
}

export type ComposerController = ReturnType<typeof useComposerController>;
