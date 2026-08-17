import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownIcon, useI18n } from '@svton/ui';
import { ActivityIndicator } from './ActivityIndicator';
import { ChatMessage } from './ChatMessage';
import { TurnSeparator } from './TurnSeparator';
import { buildSeparatorLabel, isTurnBoundary } from './chat-panel-turn.utils';
import type { ChatPanelProps } from './chat-panel.types';
import { usePinnedTranscriptScroll } from './use-pinned-transcript-scroll';

type ConversationProps = Pick<ChatPanelProps,
  | 'messages' | 'interaction' | 'onSend' | 'onApproveTool' | 'onRejectTool' | 'onRetry'
  | 'onEditMessage' | 'onOpenEditor' | 'onOpenDocument' | 'onOpenReference'
  | 'artifactInteraction'
  | 'onTimelineIntent' | 'timelineCapabilities' | 'isStreaming'
  | 'emptyMessage' | 'presets'>;

const SCROLL_THRESHOLD = 120;

/** Scroll ownership and rendering for the transcript region only. */
export function ChatPanelConversation(props: ConversationProps) {
  const { translate: t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  usePinnedTranscriptScroll(scrollRef, userScrolledUp, props.messages.length > 0);

  useEffect(() => {
    if (props.messages.length > 0 && !userScrolledUp.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [props.messages]);

  const isNearBottom = useCallback(() => {
    const element = scrollRef.current;
    return !element
      || element.scrollHeight - element.scrollTop - element.clientHeight < SCROLL_THRESHOLD;
  }, []);

  const onScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    userScrolledUp.current = !nearBottom;
    setShowScrollButton(!nearBottom);
  }, [isNearBottom]);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    userScrolledUp.current = false;
    setShowScrollButton(false);
  }, []);

  const sendPreset = useCallback((prompt: string) => {
    if (props.interaction) {
      void props.interaction.dispatch({
        id: props.interaction.createOperationId(),
        kind: 'turn.send',
        draft: { text: prompt, attachments: [] },
      });
      return;
    }
    void props.onSend?.(prompt);
  }, [props.interaction, props.onSend]);

  const executeAssistantAction = useCallback((action: string) => {
    if (!props.interaction) return Promise.resolve({
      id: `unsupported-${action}`,
      kind: 'unsupported' as const,
      message: '当前主机不支持此消息操作。',
    });
    return props.interaction.dispatch({
      id: props.interaction.createOperationId(),
      kind: 'assistantAction.execute',
      actionId: action,
    });
  }, [props.interaction]);

  return (
    <div ref={scrollRef} onScroll={onScroll} role="log" aria-label={t('chat.transcript.label')} aria-live="off" aria-busy={props.isStreaming || undefined} tabIndex={0} className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      {props.messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6">
          <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            {props.emptyMessage ?? t('chat.emptyMessage')}
          </div>
          {props.presets && props.presets.length > 0 && (
            <div className="grid w-full max-w-lg grid-cols-2 gap-2">
              {props.presets.map((preset) => (
                <button key={preset.label} onClick={() => sendPreset(preset.prompt)} className="rounded-xl border border-[#383838] bg-[#2a2a2a] px-4 py-3 text-left text-sm leading-snug text-gray-400 transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a]">
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-[1472px] py-2">
          {props.messages.map((message, index) => (
            <React.Fragment key={message.id}>
              {index > 0 && isTurnBoundary(props.messages[index - 1], message) && (
                <TurnSeparator label={message.role === 'user' && props.messages[index - 1]?.role === 'assistant'
                  ? buildSeparatorLabel(props.messages[index - 1]) : undefined} />
              )}
              <article aria-label={t('chat.message.label', { author: t(authorKey(message.role)) })} aria-live="off">
                <ChatMessage
                  {...message}
                  isLast={index === props.messages.length - 1}
                  timelineCapabilities={props.timelineCapabilities}
                  onTimelineIntent={props.onTimelineIntent}
                  onApproveTool={props.onApproveTool}
                  onRejectTool={props.onRejectTool}
                  onRetry={props.onRetry}
                  onEdit={props.onEditMessage}
                  onOpenEditor={props.onOpenEditor}
                  onOpenDocument={props.onOpenDocument}
                  onOpenReference={props.onOpenReference}
                  artifactInteraction={props.artifactInteraction}
                  onCommand={executeAssistantAction}
                  resolveCommandCapability={props.interaction?.resolveAssistantAction}
                />
              </article>
            </React.Fragment>
          ))}
        </div>
      )}
      {props.isStreaming && props.messages.length > 0 && !props.messages.at(-1)?.isStreaming && (
        <div className="px-6 py-3"><ActivityIndicator /></div>
      )}
      {showScrollButton && (
        <button onClick={scrollToBottom} className="sticky bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#383838] bg-[#2a2a2a]/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-all hover:bg-[#2a2a2a] hover:text-foreground">
          <ArrowDownIcon size={14} aria-hidden="true" /><span>{t('chat.scrollToBottom')}</span>
        </button>
      )}
    </div>
  );
}

function authorKey(role: 'user' | 'assistant' | 'system') {
  if (role === 'user') return 'chat.author.you' as const;
  if (role === 'assistant') return 'chat.author.assistant' as const;
  return 'chat.author.system' as const;
}
