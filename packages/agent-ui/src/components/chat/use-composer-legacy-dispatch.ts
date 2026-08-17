import { useCallback, useRef, useState } from 'react';
import type { ChatInputProps } from './chat-input.types';
import type {
  ComposerIntent,
  ComposerIntentResult,
  SlashCommand,
} from './composer.types';

interface LegacyDispatchOptions {
  interaction: ChatInputProps['interaction'];
  onSend: ChatInputProps['onSend'];
  onAbort: ChatInputProps['onAbort'];
  onFileReference: ChatInputProps['onFileReference'];
  slashCommands: SlashCommand[];
}

/** Preserves the pre-controller ChatInput API without forking typed intent semantics. */
export function useComposerLegacyDispatch(options: LegacyDispatchOptions) {
  const { interaction, onSend, onAbort, onFileReference, slashCommands } = options;
  const [localResult, setLocalResult] = useState<ComposerIntentResult | null>(null);
  const legacySequence = useRef(0);
  const operationId = useCallback(() => interaction?.createOperationId()
    ?? `composer-legacy-${++legacySequence.current}`, [interaction]);

  const dispatch = useCallback(async (intent: ComposerIntent): Promise<ComposerIntentResult> => {
    setLocalResult(null);
    if (interaction) return interaction.dispatch(intent);
    if (intent.kind === 'turn.send' && onSend) {
      const images = intent.draft.attachments.flatMap((item) => item.kind === 'image'
        ? [{ data: item.data, mimeType: item.mimeType }] : []);
      await onSend(intent.draft.text, images.length ? images : undefined);
      return { id: intent.id, kind: 'succeeded' };
    }
    if (intent.kind === 'turn.stop' && onAbort) {
      await onAbort();
      return { id: intent.id, kind: 'succeeded' };
    }
    if (intent.kind === 'slash.execute') {
      const command = slashCommands.find((item) => (item.id ?? item.name) === intent.commandId);
      if (command?.execute && command.capability?.supported !== false) {
        const accepted = await command.execute(intent.args);
        if (accepted === false) return {
          id: intent.id,
          kind: 'busy',
          retryable: true,
          message: '命令未被当前会话接受；草稿已保留。',
        };
        return { id: intent.id, kind: 'succeeded' };
      }
      if (command?.action && command.capability?.supported !== false) {
        command.action();
        return { id: intent.id, kind: 'succeeded' };
      }
    }
    if (intent.kind === 'draft.file.pick' && onFileReference) {
      await onFileReference();
      return { id: intent.id, kind: 'succeeded' };
    }
    const result: ComposerIntentResult = {
      id: intent.id,
      kind: 'unsupported',
      message: '当前主机不支持此操作。',
    };
    setLocalResult(result);
    return result;
  }, [interaction, onAbort, onFileReference, onSend, slashCommands]);

  return { dispatch, localResult, operationId, setLocalResult };
}
