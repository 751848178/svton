import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { cn, t } from '@svton/ui';
import { ChatMessage, type ChatMessageProps } from './ChatMessage';
import { ActivityIndicator } from './ActivityIndicator';
import { ChatInput, type ChatInputProps, type SlashCommand } from './ChatInput';
import { TurnSeparator } from './TurnSeparator';
import { ToolApprovalModal } from './ToolApprovalModal';
import { PlanPanel, type PlanInfo } from './PlanPanel';
import type { ToolCallInfo } from './ToolCallCard';

export interface ChatPanelMessage extends Omit<ChatMessageProps, 'onApproveTool' | 'onRejectTool' | 'className'> {
  id: string;
  /** Token usage for this turn (assistant messages) */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface PresetItem {
  label: string;
  prompt: string;
}

export interface ChatPanelProps {
  messages: ChatPanelMessage[];
  onSend: ChatInputProps['onSend'];
  /** Abort an in-progress streaming response */
  onAbort?: () => void;
  onApproveTool?: (callId: string) => void;
  onRejectTool?: (callId: string) => void;
  onRetry?: (messageId?: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onOpenEditor?: (content: string) => void;
  onOpenDocument?: (doc: import('./SplitScreenPanel').SplitScreenContent) => void;
  /** Open a file reference (from reference block) */
  onOpenReference?: (path: string, line?: number) => void;
  /** Execute a command (from command block) */
  onCommand?: (action: string) => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: React.ReactNode;
  /** Starter suggestions shown when message list is empty */
  presets?: PresetItem[];
  /** Extra element in the input bar (e.g. model selector + controls) */
  inputLeadingSlot?: React.ReactNode;
  /** Extra action buttons in the input bar */
  inputTrailingSlot?: React.ReactNode;
  /** Slash commands for the input */
  slashCommands?: SlashCommand[];
  /** Items shown when user types @ */
  mentionItems?: import('./ChatInput').MentionItem[];
  /** Called when user selects a mention item */
  onMentionSelect?: (item: import('./ChatInput').MentionItem) => string;
  /** Called when user clicks "引用文件" in attach menu */
  onFileReference?: () => void;
  /** Previously submitted text prompts, oldest to newest */
  inputHistory?: string[];
  /** Names of currently matched skills (shown as status bar) */
  matchedSkills?: string[];
  /** Active plan to display progress for */
  activePlan?: PlanInfo | null;
  className?: string;
}

/**
 * Determine if a turn separator should be shown before a message.
 * Separator goes between: user→assistant or assistant→user transitions.
 */
function isTurnBoundary(prev: ChatPanelMessage, curr: ChatPanelMessage): boolean {
  if (curr.role === 'system') return false;
  if (prev.role === 'system') return false;
  return prev.role !== curr.role;
}

/** Format token usage for display in turn separator */
function formatUsage(usage?: { promptTokens: number; completionTokens: number; totalTokens: number }): string | undefined {
  if (!usage || usage.totalTokens === 0) return undefined;
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return `${fmt(usage.promptTokens)} in → ${fmt(usage.completionTokens)} out`;
}

/** Format duration for the turn separator (Codex-style: "Worked for Xm Ys" when >60s). */
function formatDuration(ms?: number): string | undefined {
  if (!ms || ms < 1000) return undefined;
  const s = Math.round(ms / 1000);
  if (s < 60) return undefined; // Only show when >= 60s (matches Codex threshold)
  const m = Math.floor(s / 60);
  const remainingSec = s % 60;
  if (m < 60) return `Worked for ${m}m ${String(remainingSec).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `Worked for ${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Build the turn separator label: duration (if >60s) + token usage. */
function buildSeparatorLabel(
  prevMsg?: ChatPanelMessage,
): string | undefined {
  if (!prevMsg || prevMsg.role !== 'assistant') return undefined;
  const parts: string[] = [];
  const dur = formatDuration(prevMsg.duration);
  if (dur) parts.push(dur);
  const usage = formatUsage(prevMsg.usage);
  if (usage) parts.push(usage);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** Threshold in px to consider "near bottom" for auto-scroll */
const SCROLL_THRESHOLD = 120;

/**
 * Complete chat panel: message list + input box.
 * Codex-style: turn separators between user/assistant transitions.
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSend,
  onAbort,
  onApproveTool,
  onRejectTool,
  onRetry,
  onEditMessage,
  onOpenEditor,
  onOpenDocument,
  onOpenReference,
  onCommand,
  isStreaming,
  disabled,
  placeholder,
  emptyMessage,
  presets,
  inputLeadingSlot,
  inputTrailingSlot,
  slashCommands,
  mentionItems,
  onMentionSelect,
  onFileReference,
  inputHistory,
  matchedSkills,
  activePlan,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const userScrolledUp = useRef(false);

  // Find the first pending tool approval across all messages.
  // Checks BOTH msg.toolCalls (legacy path) AND msg.blocks (modern path),
  // since tool calls may live in either place.
  const pendingApproval = useMemo<ToolCallInfo | null>(() => {
    for (const msg of messages) {
      // Legacy: msg.toolCalls array
      if (msg.toolCalls) {
        const pending = msg.toolCalls.find((tc) => tc.status === 'pending_approval');
        if (pending) return pending;
      }
      // Modern: msg.blocks with tool_call type
      if (msg.blocks) {
        for (const block of msg.blocks) {
          if (block.type === 'tool_call' && block.call?.status === 'pending_approval') {
            return block.call;
          }
        }
      }
    }
    return null;
  }, [messages]);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  // Auto-scroll to bottom on new messages (only if user hasn't scrolled up)
  useEffect(() => {
    if (!userScrolledUp.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Track user scroll to detect if they scrolled up
  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    userScrolledUp.current = !nearBottom;
    setShowScrollBtn(!nearBottom);
  }, [isNearBottom]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      userScrolledUp.current = false;
      setShowScrollBtn(false);
    }
  }, []);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-6">{emptyMessage ?? t('chat.emptyMessage')}</div>
            {presets && presets.length > 0 && (
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => onSend(preset.prompt)}
                    className="text-left px-4 py-3 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] hover:bg-[#222] hover:border-[#333] transition-colors text-sm text-gray-400 leading-snug"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-[1472px] mx-auto py-2">
            {messages.map((msg, i) => (
              <React.Fragment key={msg.id}>
                {/* Turn separator — only between user→assistant, show usage after assistant completes */}
                {i > 0 && isTurnBoundary(messages[i - 1], msg) && (
                  <TurnSeparator
                    label={
                      // Show label when assistant turn ends (i.e., next message is user)
                      msg.role === 'user' && messages[i - 1]?.role === 'assistant'
                        ? buildSeparatorLabel(messages[i - 1])
                        : undefined
                    }
                  />
                )}
                <ChatMessage
                  id={msg.id}
                  role={msg.role}
                  content={msg.content}
                  thinking={msg.thinking}
                  error={msg.error}
                  toolCalls={msg.toolCalls}
                  blocks={msg.blocks}
                  isStreaming={msg.isStreaming}
                  isLast={i === messages.length - 1}
                  systemType={msg.systemType}
                  duration={msg.duration}
                  activeSkills={msg.activeSkills}
                  onApproveTool={onApproveTool}
                  onRejectTool={onRejectTool}
                  onRetry={onRetry}
                  onEdit={onEditMessage}
                  onOpenEditor={onOpenEditor}
                  onOpenDocument={onOpenDocument}
                  onOpenReference={onOpenReference}
                  onCommand={onCommand}
                />
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Streaming indicator — shown between turns when the next assistant
            message hasn't been created yet. Uses the same shimmer style as the
            per-message ActivityIndicator for visual consistency. */}
        {isStreaming && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
          <div className="px-6 py-3">
            <ActivityIndicator />
          </div>
        )}

        {/* Jump to bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1c1c1c]/90 border border-[#2a2a2a] shadow-sm text-xs text-gray-500 hover:text-gray-300 hover:bg-[#222] transition-all"
          >
            <span>↓</span>
            <span>{t('chat.scrollToBottom')}</span>
          </button>
        )}
      </div>

      {/* Note: skill match indicator moved into the per-message ActivityIndicator
          (shows "正在使用 <skill>..." while streaming). matchedSkills prop is
          accepted for backward compat but no longer rendered here. */}

      {/* Active plan progress */}
      {activePlan && activePlan.steps.length > 0 && (
        <PlanPanel plan={activePlan} />
      )}

      {/* Input — aligned to the same max-width column as messages */}
      <div className="max-w-[1472px] w-full mx-auto px-6">
        <ChatInput
          onSend={onSend}
          onAbort={onAbort}
          isStreaming={isStreaming}
          disabled={disabled}
          placeholder={placeholder}
          leadingSlot={inputLeadingSlot}
          trailingSlot={inputTrailingSlot}
          slashCommands={slashCommands}
          mentionItems={mentionItems}
          onMentionSelect={onMentionSelect}
          onFileReference={onFileReference}
          inputHistory={inputHistory}
        />
      </div>

      {/* Tool approval modal — auto-opens when a tool needs permission */}
      {pendingApproval && onApproveTool && onRejectTool && (
        <ToolApprovalModal
          toolCall={pendingApproval}
          onApprove={onApproveTool}
          onReject={onRejectTool}
        />
      )}
    </div>
  );
};
