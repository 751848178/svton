import React from 'react';
import { ComposerActions } from './ComposerActions';
import { ComposerSurface } from './ComposerSurface';
import type { ChatInputProps } from './chat-input.types';
import { useComposerController } from './use-composer-controller';

export type { ChatInputProps, ImageAttachment } from './chat-input.types';
export type { MentionItem, SlashCommand } from './composer.types';

/** Shared draft composer; local state is coordinated by one controller hook. */
export const ChatInput: React.FC<ChatInputProps> = (props) => {
  const controller = useComposerController(props);
  return (
    <ComposerSurface
      controller={controller}
      disabled={props.disabled}
      placeholder={props.placeholder}
      className={props.className}
      actions={(
        <ComposerActions
          controller={controller}
          disabled={props.disabled}
          isStreaming={props.isStreaming}
          canAbort={Boolean(props.interaction || props.onAbort)}
          leadingSlot={props.leadingSlot}
          trailingSlot={props.trailingSlot}
        />
      )}
    />
  );
};
