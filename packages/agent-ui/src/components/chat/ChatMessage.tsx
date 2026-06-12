import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn, t } from '@svton/ui';
import { StreamingText } from './StreamingText';
import { ToolCallCard, type ToolCallInfo } from './ToolCallCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ExportManager } from './ExportManager';
import { DocumentCard, detectDocumentContent, type DocumentKind } from './DocumentCard';
import type { SplitScreenContent } from './SplitScreenPanel';

/**
 * Ordered content block for rendering in execution order.
 * Mirrors the ContentBlock type from agent-client.
 */
export interface ContentBlock {
  type: 'thinking' | 'tool_call' | 'text' | 'error';
  text?: string;
  call?: ToolCallInfo;
}

export interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  error?: string;
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls?: ToolCallInfo[];
  /** Ordered content blocks for interleaved rendering */
  blocks?: ContentBlock[];
  isStreaming?: boolean;
  /** Whether this is the last message in the list */
  isLast?: boolean;
  /** System notification type for distinct rendering */
  systemType?: 'default' | 'context_compacted';
  /** Duration in ms for completed assistant turns */
  duration?: number;
  onApproveTool?: (callId: string) => void;
  onRejectTool?: (callId: string) => void;
  onRetry?: (messageId?: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onOpenEditor?: (content: string) => void;
  /** Open a document in the split-screen panel */
  onOpenDocument?: (doc: SplitScreenContent) => void;
  className?: string;
}

/**
 * Codex-style message: structural prefixes, no bubbles.
 * Supports retry (assistant) and edit (user) actions.
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  role,
  content,
  thinking,
  error,
  images,
  toolCalls,
  blocks,
  isStreaming,
  isLast,
  systemType,
  duration,
  onApproveTool,
  onRejectTool,
  onRetry,
  onEdit,
  onOpenEditor,
  onOpenDocument,
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [hovered, setHovered] = useState(false);
  const [processExpanded, setProcessExpanded] = useState(() => isStreaming === true);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = 'auto';
      editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 200)}px`;
    }
  }, [isEditing]);

  // Auto-collapse process blocks when streaming finishes
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setProcessExpanded(false);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  if (role === 'system') {
    if (systemType === 'context_compacted') {
      return (
        <div className={cn('px-6 py-2 flex items-center justify-center gap-2', className)}>
          <span className="text-gray-300">─</span>
          <span className="text-[11px] text-gray-400">{t('chat.contextCompacted')}</span>
          <span className="text-gray-300">─</span>
        </div>
      );
    }
    return (
      <div className={cn('px-6 py-2 text-center', className)}>
        <span className="text-xs text-gray-400">{content}</span>
      </div>
    );
  }

  if (role === 'user') {
    const [userCopied, setUserCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(content);
        setUserCopied(true);
        setTimeout(() => setUserCopied(false), 2000);
      } catch { /* Non-HTTPS fallback */ }
    };

    const handleStartEdit = () => {
      setEditContent(content);
      setIsEditing(true);
    };

    const handleSubmitEdit = () => {
      const trimmed = editContent.trim();
      if (trimmed && trimmed !== content) {
        onEdit?.(id, trimmed);
      }
      setIsEditing(false);
    };

    const handleCancelEdit = () => {
      setIsEditing(false);
    };

    return (
      <div
        className={cn('group flex justify-end', className)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="px-6 py-3 max-w-[80%]">
          {isEditing ? (
            <div className="min-w-0">
              <textarea
                ref={editRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitEdit();
                  }
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="w-full text-sm text-gray-100 bg-[#222] rounded-lg px-3 py-2 border border-[#333] focus:border-cyan-600 focus:ring-1 focus:ring-blue-400 outline-none resize-none max-h-[200px]"
              />
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={handleSubmitEdit}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200"
                >
                  发送
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-[#333] text-gray-400 hover:bg-[#222]"
                >
                  取消
                </button>
                <span className="text-[10px] text-gray-400">{t('chat.editHint')}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-[#1c1c1c] rounded-2xl px-4 py-2.5 min-w-0">
                <div className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
                  {content}
                </div>
                {images && images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {images.map((img, i) => (
                      <img
                        key={i}
                        src={img.data.startsWith('data:') || img.data.startsWith('http') ? img.data : `data:${img.mimeType || 'image/png'};base64,${img.data}`}
                        alt={`Image ${i + 1}`}
                        className="max-w-xs max-h-48 rounded-lg border border-[#2a2a2a]"
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* Actions: Copy + Retry + Edit — hover visible */}
              <div className={cn(
                'flex justify-end mt-1 gap-0.5 transition-opacity',
                hovered ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}>
                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200 rounded-md hover:bg-[#2a2a2a] transition-colors"
                  title="Copy"
                >
                  {userCopied ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                        <polyline points="4 8 7 11 12 5" />
                      </svg>
                      <span className="text-green-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="5" width="9" height="9" rx="1" />
                        <path d="M3 11V3a1 1 0 0 1 1-1h8" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>

                {/* Retry */}
                {onRetry && (
                  <button
                    onClick={() => onRetry(id)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200 rounded-md hover:bg-[#2a2a2a] transition-colors"
                    title="Retry"
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v4h4" />
                      <path d="M3.5 11.5A5.5 5.5 0 1 0 4.5 5L1 8" />
                    </svg>
                    Retry
                  </button>
                )}

                {/* Edit */}
                {onEdit && (
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200 rounded-md hover:bg-[#2a2a2a] transition-colors"
                    title={t('chat.editMessage')}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Assistant — render blocks in execution order if available
  const hasBlocks = blocks && blocks.length > 0;
  const isCompleted = !isStreaming;

  // Count process blocks (thinking + tool calls) for the collapsed summary
  const hasProcess = hasBlocks && blocks!.some((b) => b.type === 'thinking' || b.type === 'tool_call');

  // Format duration for display
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };

  return (
    <div
      className={cn('px-6 py-3 group', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hasBlocks ? (
        <>
          {/* Collapsed process summary */}
          {!processExpanded && hasProcess && (
            <button
              onClick={() => setProcessExpanded(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-[#1c1c1c] transition-colors text-left"
            >
              <span className="text-gray-400 select-none">▸</span>
              <span className="text-gray-400">已处理</span>
              {duration != null && (
                <span className="text-gray-600 ml-1">{formatDuration(duration)}</span>
              )}
            </button>
          )}
          {processExpanded && !isStreaming && hasProcess && (
            <button
              onClick={() => setProcessExpanded(false)}
              className="w-full flex items-center gap-2 px-2 py-1 mb-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-[#1c1c1c] transition-colors text-left"
            >
              <span className="text-gray-400 select-none">▾</span>
              <span className="text-gray-400">已处理</span>
              {duration != null && (
                <span className="text-gray-600 ml-1">{formatDuration(duration)}</span>
              )}
            </button>
          )}

          {/* Render ALL blocks in original order — thinking/tools/text interleaved */}
          {blocks!.map((block, i) => {
            const isProcess = block.type === 'thinking' || block.type === 'tool_call';

            // Process blocks: respect expand/collapse state
            if (isProcess && !(processExpanded || isStreaming)) return null;

            if (block.type === 'thinking') {
              return <ThinkingBlock key={`think-${i}`} text={block.text!} isStreaming={isStreaming} />;
            }
            if (block.type === 'tool_call' && block.call) {
              return (
                <div key={`tool-${block.call.id}`} className="mb-1">
                  <ToolCallCard
                    toolCall={block.call}
                    onApprove={onApproveTool}
                    onReject={onRejectTool}
                    defaultCollapsed={isCompleted}
                  />
                </div>
              );
            }
            if (block.type === 'text' && block.text) {
              const txt = block.text;
              return (
                <div key={`text-${i}`}>
                  <div className="min-w-0 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                    {isStreaming && i === blocks!.length - 1 ? (
                      <StreamingMarkdown text={txt} />
                    ) : !isStreaming && onOpenDocument && detectDocumentContent(txt) ? (
                      <DocumentCard
                        title={detectDocumentContent(txt)!.title}
                        snippet={detectDocumentContent(txt)!.snippet}
                        kind={detectDocumentContent(txt)!.kind}
                        extension={detectDocumentContent(txt)!.extension}
                        onClick={() => {
                          const doc = detectDocumentContent(txt)!;
                          onOpenDocument({ type: 'document', title: doc.title, content: txt });
                        }}
                      />
                    ) : (
                      <MarkdownRenderer content={txt} />
                    )}
                  </div>
                </div>
              );
            }
            if (block.type === 'error' && block.text) {
              return (
                <div key={`err-${i}`} className="flex items-start gap-2 mt-2">
                  <span className="text-red-500 select-none flex-shrink-0 mt-px">✗</span>
                  <div className="text-sm text-red-600 leading-relaxed">{block.text}</div>
                </div>
              );
            }
            return null;
          })}
        </>
      ) : (
        // Fallback: legacy grouped rendering (no blocks available)
        <>
          {thinking && <ThinkingBlock text={thinking} isStreaming={isStreaming} />}

          {toolCalls && toolCalls.length > 0 && (
            <div className="mb-2 space-y-1">
              <ToolCallList toolCalls={toolCalls} onApprove={onApproveTool} onReject={onRejectTool} defaultCollapsed={isCompleted} />
            </div>
          )}

          {content && (
            <div>
              <div className="min-w-0 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                {isStreaming ? (
                  <StreamingMarkdown text={content} />
                ) : !isStreaming && onOpenDocument && detectDocumentContent(content) ? (
                  <DocumentCard
                    title={detectDocumentContent(content)!.title}
                    snippet={detectDocumentContent(content)!.snippet}
                    kind={detectDocumentContent(content)!.kind}
                    extension={detectDocumentContent(content)!.extension}
                    onClick={() => {
                      const doc = detectDocumentContent(content)!;
                      onOpenDocument({ type: 'document', title: doc.title, content });
                    }}
                  />
                ) : (
                  <MarkdownRenderer content={content} />
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 mt-2">
              <span className="text-red-500 select-none flex-shrink-0 mt-px">✗</span>
              <div className="text-sm text-red-600 leading-relaxed">{error}</div>
            </div>
          )}
        </>
      )}

      {/* Action buttons — visible on hover for completed assistant messages */}
      {!isStreaming && content && (
        <AssistantActions
          content={content}
          hovered={hovered}
          isLast={isLast}
          onRetry={onRetry}
          onOpenEditor={onOpenEditor}
        />
      )}
    </div>
  );
};

// ─── ThinkingBlock ────────────────────────────────────────
function ThinkingBlock({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(true);
  const prevStreamingRef = useRef(isStreaming);

  // Auto-collapse when streaming finishes
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setOpen(false);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-500 transition-colors"
      >
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
        <span className="italic">Thinking</span>
      </button>
      {open && (
        <div className="mt-1 pl-4 border-l-2 border-[#333] text-xs text-gray-400 italic leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── StreamingMarkdown — renders markdown during streaming ──
function StreamingMarkdown({ text }: { text: string }) {
  return (
    <>
      <MarkdownRenderer content={text} />
      <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-100 animate-pulse align-text-bottom" />
    </>
  );
}

// ─── AssistantActions — Copy / Edit / Export / Retry ────────
function AssistantActions({
  content,
  hovered,
  isLast,
  onRetry,
  onOpenEditor,
}: {
  content: string;
  hovered: boolean;
  isLast?: boolean;
  onRetry?: (messageId?: string) => void;
  onOpenEditor?: (content: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-HTTPS fallback
    }
  }, [content]);

  // Always render to avoid layout shift; use visibility for non-last messages
  const visible = hovered || isLast;

  return (
    <div className={cn(
      'flex items-center gap-1 mt-2 ml-5 transition-opacity',
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
    )}>
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200 rounded-md hover:bg-[#2a2a2a] transition-colors"
        title="Copy"
      >
        {copied ? (
          <>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
              <polyline points="4 8 7 11 12 5" />
            </svg>
            <span className="text-green-500">Copied</span>
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="5" width="9" height="9" rx="1" />
              <path d="M3 11V3a1 1 0 0 1 1-1h8" />
            </svg>
            Copy
          </>
        )}
      </button>

      {/* Edit in editor */}
      {onOpenEditor && (
        <button
          onClick={() => onOpenEditor(content)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-300 rounded-md hover:bg-[#222] transition-colors"
          title="Edit"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
          </svg>
          Edit
        </button>
      )}

      {/* Export */}
      <ExportManager content={content}>
        {(onClick) => (
          <button
            onClick={onClick}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-300 rounded-md hover:bg-[#222] transition-colors"
            title="Export"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
              <polyline points="5 6 8 9 11 6" />
              <line x1="8" y1="2" x2="8" y2="9" />
            </svg>
            Export
          </button>
        )}
      </ExportManager>

      {/* Retry */}
      {onRetry && isLast && (
        <button
          onClick={() => onRetry()}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-300 rounded-md hover:bg-[#222] transition-colors"
          title="Regenerate"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v4h4" />
            <path d="M3.5 11.5A5.5 5.5 0 1 0 4.5 5L1 8" />
          </svg>
          Retry
        </button>
      )}
    </div>
  );
}

// ─── ToolCallList ─────────────────────────────────────────
const EXPLORING_TOOLS = new Set([
  'file_read', 'read', 'grep', 'search', 'glob', 'list_files', 'web_search', 'web_fetch',
]);

function isExplorable(tc: ToolCallInfo): boolean {
  return EXPLORING_TOOLS.has(tc.name) && tc.status === 'completed' && !tc.result?.isError;
}

function ToolCallList({
  toolCalls,
  onApprove,
  onReject,
  defaultCollapsed,
}: {
  toolCalls: ToolCallInfo[];
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
  defaultCollapsed?: boolean;
}) {
  const groups: Array<{ type: 'single'; tc: ToolCallInfo } | { type: 'exploring'; calls: ToolCallInfo[] }> = [];
  let i = 0;
  while (i < toolCalls.length) {
    if (isExplorable(toolCalls[i])) {
      const batch: ToolCallInfo[] = [];
      while (i < toolCalls.length && isExplorable(toolCalls[i])) {
        batch.push(toolCalls[i]);
        i++;
      }
      groups.push({ type: 'exploring', calls: batch });
    } else {
      groups.push({ type: 'single', tc: toolCalls[i] });
      i++;
    }
  }

  return (
    <>
      {groups.map((group, gi) => {
        if (group.type === 'single') {
          return (
            <ToolCallCard
              key={group.tc.id}
              toolCall={group.tc}
              onApprove={onApprove}
              onReject={onReject}
              defaultCollapsed={defaultCollapsed}
            />
          );
        }
        return (
          <ExploringGroup
            key={`explore-${gi}`}
            calls={group.calls}
            onApprove={onApprove}
            onReject={onReject}
            defaultCollapsed={defaultCollapsed}
          />
        );
      })}
    </>
  );
}

// ─── ExploringGroup — extracted to its own component (hooks-safe) ───
function ExploringGroup({
  calls,
  onApprove,
  onReject,
  defaultCollapsed,
}: {
  calls: ToolCallInfo[];
  onApprove?: (callId: string) => void;
  onReject?: (callId: string) => void;
  defaultCollapsed?: boolean;
}) {
  const isActive = calls.some((c) => c.status === 'running');
  const [expanded, setExpanded] = useState(() => defaultCollapsed ? false : !isActive);

  return (
    <div className="text-sm">
      <button
        className="flex items-center gap-1.5 text-left group w-full"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-300 select-none">│</span>
        <span className={cn(
          'text-xs flex-shrink-0',
          isActive ? 'text-blue-400 animate-pulse' : 'text-gray-400',
        )}>•</span>
        <span className="text-xs font-semibold text-gray-300">
          {isActive ? 'Exploring' : 'Explored'}
        </span>
        <span className="text-xs text-gray-400">
          ({calls.length} {calls.length === 1 ? 'call' : 'calls'})
        </span>
        <span className="text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {!expanded && (
        <div className="ml-5 mt-0.5">
          <span className="text-gray-300 text-xs select-none">└ </span>
          <span className="text-xs text-gray-500">
            {calls.map((c) => {
              const arg = Object.values(c.arguments).map((v) =>
                typeof v === 'string' ? v : JSON.stringify(v)
              ).join(' ');
              return arg.length > 40 ? arg.slice(0, 40) + '…' : arg;
            }).filter(Boolean).join(', ')}
          </span>
        </div>
      )}

      {expanded && calls.map((tc) => (
        <ToolCallCard
          key={tc.id}
          toolCall={tc}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  );
}
