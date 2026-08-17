import { useCallback, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import {
  clampComposerIndex,
  isOnFirstComposerLine,
  isOnLastComposerLine,
} from './composer-selection.utils';
import type { MentionItem, SlashCommand } from './composer.types';

interface ComposerKeyboardOptions {
  value: string;
  commands: SlashCommand[];
  mentions: MentionItem[];
  selectedCommand: number;
  selectedMention: number;
  setSelectedCommand: Dispatch<SetStateAction<number>>;
  setSelectedMention: Dispatch<SetStateAction<number>>;
  dismiss: (kind: 'commands' | 'mentions') => void;
  executeCommand: (command: SlashCommand) => Promise<void>;
  addMention: (item: MentionItem) => void;
  sendDraft: () => Promise<void>;
  history: { navigate: (direction: 'previous' | 'next') => boolean };
}

/** Owns textarea keyboard routing without owning composer state. */
export function useComposerKeyboard(options: ComposerKeyboardOptions) {
  return useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    const {
      value, commands, mentions, selectedCommand, selectedMention,
      setSelectedCommand, setSelectedMention, dismiss,
      executeCommand, addMention, sendDraft, history,
    } = options;
    if (commands.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setSelectedCommand((index) => clampComposerIndex(
        index + (event.key === 'ArrowDown' ? 1 : -1),
        commands.length,
      ));
      return;
    }
    if (commands.length && (event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
      event.preventDefault();
      void executeCommand(commands[selectedCommand] ?? commands[0]);
      return;
    }
    if (mentions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setSelectedMention((index) => clampComposerIndex(
        index + (event.key === 'ArrowDown' ? 1 : -1),
        mentions.length,
      ));
      return;
    }
    if (mentions.length && (event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
      event.preventDefault();
      addMention(mentions[selectedMention] ?? mentions[0]);
      return;
    }
    if (event.key === 'Escape' && (commands.length || mentions.length)) {
      event.preventDefault();
      dismiss(commands.length ? 'commands' : 'mentions');
      return;
    }
    const composing = (event.nativeEvent as globalThis.KeyboardEvent).isComposing;
    const modifier = event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
    if (!composing && !modifier && event.key === 'ArrowUp'
      && isOnFirstComposerLine(value, event.currentTarget)) {
      if (history.navigate('previous')) event.preventDefault();
      return;
    }
    if (!composing && !modifier && event.key === 'ArrowDown'
      && isOnLastComposerLine(value, event.currentTarget)) {
      if (history.navigate('next')) event.preventDefault();
      return;
    }
    if (!composing && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendDraft();
    }
  }, [options]);
}
