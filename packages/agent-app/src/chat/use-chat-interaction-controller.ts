import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  ComposerFileAdapter,
  ComposerIntent,
  ComposerIntentResult,
  ComposerInteraction,
  ComposerSubmission,
  SlashCommand,
} from '@svton/agent-ui';
import { MAX_COMPOSER_FILE_BYTES } from '@svton/agent-ui';
import { useI18n, type Translator } from '@svton/ui';
import { buildComposerSubmission } from './composer-submission';

interface InteractionOptions {
  canSend: boolean;
  isStreaming: boolean;
  send: (submission: ComposerSubmission) => Promise<boolean>;
  stop?: () => void | Promise<void>;
  slashCommands?: SlashCommand[];
  assistantActions?: Record<string, (payload?: unknown) => void | Promise<void>>;
  fileAdapter?: ComposerFileAdapter;
}

const publicFailure = (id: string, t: Translator): ComposerIntentResult => ({
  id,
  kind: 'failed',
  message: t('chat.interaction.failed'),
  retryable: true,
});

export function useChatInteractionController(options: InteractionOptions): ComposerInteraction {
  const { translate: t } = useI18n();
  const sequence = useRef(0);
  const inFlight = useRef(false);
  const [result, setResult] = useState<ComposerIntentResult | null>(null);
  const [pending, setPending] = useState(false);
  const commands = useMemo(
    () => new Map((options.slashCommands ?? []).map((command) => [command.id ?? command.name, command])),
    [options.slashCommands],
  );

  const createOperationId = useCallback(
    () => `composer-${Date.now().toString(36)}-${++sequence.current}`,
    [],
  );
  const resolveAssistantAction = useCallback((actionId: string) => (
    options.assistantActions?.[actionId]
      ? { supported: true as const }
      : { supported: false as const, reason: t('command.unavailable') }
  ), [options.assistantActions, t]);

  const run = useCallback(async (intent: ComposerIntent): Promise<ComposerIntentResult> => {
    if (intent.kind === 'turn.send') {
      if (options.isStreaming || !options.canSend) return {
        id: intent.id, kind: 'busy', retryable: true,
        message: t('chat.interaction.sendBusy'),
      };
      const built = await buildComposerSubmission(intent.draft, options.fileAdapter, t);
      if (built.kind === 'failed') return {
        id: intent.id, kind: 'failed', retryable: true, message: built.message,
      };
      const accepted = await options.send(built.submission);
      return accepted === false
        ? { id: intent.id, kind: 'busy', retryable: true, message: t('chat.interaction.sendRejected') }
        : { id: intent.id, kind: 'succeeded' };
    }
    if (intent.kind === 'turn.stop') {
      if (!options.stop) return { id: intent.id, kind: 'unsupported', message: t('chat.interaction.stopUnsupported') };
      await options.stop();
      return { id: intent.id, kind: 'succeeded', message: t('chat.interaction.stopRequested') };
    }
    if (intent.kind === 'draft.file.pick') {
      if (!options.fileAdapter?.capability.supported) return {
        id: intent.id, kind: 'unsupported',
        message: unsupportedReason(options.fileAdapter?.capability, t('chat.interaction.fileUnsupported')),
      };
      const picked = await options.fileAdapter.pick();
      if (picked.kind === 'cancelled') return { id: intent.id, kind: 'cancelled' };
      if (picked.kind === 'failed') return { id: intent.id, kind: 'failed', message: picked.message, retryable: true };
      if (picked.attachment.size > MAX_COMPOSER_FILE_BYTES) return {
        id: intent.id, kind: 'failed', retryable: true,
        message: t('chat.interaction.fileTooLarge', { name: picked.attachment.name }),
      };
      return { id: intent.id, kind: 'succeeded', attachment: picked.attachment };
    }
    if (intent.kind === 'slash.execute') {
      const command = commands.get(intent.commandId);
      const capability = command?.capability
        ?? (command?.execute || command?.action ? { supported: true as const } : undefined);
      if (!command || !capability?.supported) return {
        id: intent.id, kind: 'unsupported', message: unsupportedReason(capability, t('chat.interaction.commandUnsupported')),
      };
      if ((options.isStreaming || !options.canSend) && !command.allowWhileBusy) return {
        id: intent.id, kind: 'busy', retryable: true, message: t('chat.interaction.commandBusy'),
      };
      let accepted: boolean | void;
      if (command.execute) accepted = await command.execute(intent.args);
      else {
        command.action?.();
        accepted = undefined;
      }
      if (accepted === false) return {
        id: intent.id, kind: 'busy', retryable: true, message: t('chat.interaction.commandRejected'),
      };
      return { id: intent.id, kind: 'succeeded', message: t('chat.interaction.commandSucceeded', { name: command.name }) };
    }
    const capability = resolveAssistantAction(intent.actionId);
    if (!capability.supported) return { id: intent.id, kind: 'unsupported', message: capability.reason };
    await options.assistantActions?.[intent.actionId]?.(intent.payload);
    return { id: intent.id, kind: 'succeeded', message: t('chat.interaction.actionSucceeded') };
  }, [commands, options, resolveAssistantAction, t]);

  const dispatch = useCallback(async (intent: ComposerIntent) => {
    if (inFlight.current) {
      const busy: ComposerIntentResult = {
        id: intent.id, kind: 'busy', retryable: true, message: t('chat.interaction.operationBusy'),
      };
      setResult(busy);
      return busy;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const next = await run(intent);
      setResult(next);
      return next;
    } catch {
      const next = publicFailure(intent.id, t);
      setResult(next);
      return next;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [run, t]);

  return { dispatch, createOperationId, result, pending, resolveAssistantAction };
}

function unsupportedReason(
  capability: { supported: true } | { supported: false; reason: string } | undefined,
  fallback: string,
) {
  return capability && !capability.supported ? capability.reason : fallback;
}
