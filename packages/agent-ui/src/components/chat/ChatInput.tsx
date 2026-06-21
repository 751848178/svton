import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn, t } from '@svton/ui';

const MAX_IMAGE_ATTACHMENTS = 8;
const MAX_INLINE_FILE_CHARS = 20000;

// ── Slash command definitions ──────────────────────────────

export interface SlashCommand {
  name: string;
  description: string;
  /** Execute the command */
  action: () => void;
}

export interface ImageAttachment {
  data: string; // base64
  mimeType: string;
}

export interface MentionItem {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  /** Category for grouping in the mention popup */
  category?: 'file' | 'folder' | 'tool' | 'skill';
}

export interface ChatInputProps {
  onSend: (content: string, images?: ImageAttachment[]) => void;
  /** Abort an in-progress streaming response */
  onAbort?: () => void;
  /** Whether the agent is currently streaming a response */
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Extra element rendered in the bottom bar (e.g. model selector, mode controls) */
  leadingSlot?: React.ReactNode;
  /** Extra action buttons rendered after the send button */
  trailingSlot?: React.ReactNode;
  /** Available slash commands */
  slashCommands?: SlashCommand[];
  /** Items shown when user types @ */
  mentionItems?: MentionItem[];
  /** Called when user selects a mention item — return the inserted text */
  onMentionSelect?: (item: MentionItem) => string;
  /** Called when user selects a file to reference — return the text to insert */
  onFileReference?: () => void;
  /** Previously submitted text prompts, oldest to newest */
  inputHistory?: string[];
  className?: string;
}

/**
 * Codex-style chat input: rounded card container, integrated controls.
 * Supports slash commands with autocomplete and @ mentions.
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onAbort,
  isStreaming,
  disabled,
  placeholder,
  leadingSlot,
  trailingSlot,
  slashCommands = [],
  mentionItems = [],
  onMentionSelect,
  onFileReference,
  inputHistory = [],
  className,
}) => {
  const [value, setValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draftBeforeHistory, setDraftBeforeHistory] = useState('');
  const [focused, setFocused] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCmd, setSelectedCmd] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [selectedMention, setSelectedMention] = useState(0);
  const [mentionCategoryIdx, setMentionCategoryIdx] = useState(0);
  const [mentionItemIdx, setMentionItemIdx] = useState(0);
  const [mentionPhase, setMentionPhase] = useState<'category' | 'items'>('category');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [popupPos, setPopupPos] = useState<{ left: number; bottom: number; width: number }>({ left: 0, bottom: 0, width: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileRefInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate popup position from container
  const updatePopupPos = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPopupPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width });
    }
  }, []);

  // Detect inline @ mention at cursor position
  const getMentionContext = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { active: false, query: '', start: -1 };
    const pos = textarea.selectionStart;
    const text = value;
    // Walk backwards from cursor to find the @ that starts this mention
    let start = pos - 1;
    while (start >= 0 && text[start] !== '@' && text[start] !== ' ' && text[start] !== '\n') {
      start--;
    }
    if (start >= 0 && text[start] === '@') {
      // Make sure the char before @ is a space, newline, or start of string
      if (start === 0 || text[start - 1] === ' ' || text[start - 1] === '\n') {
        const query = text.slice(start + 1, pos).toLowerCase();
        return { active: true, query, start };
      }
    }
    return { active: false, query: '', start: -1 };
  }, [value]);

  // Filter commands based on current input
  const query = value.startsWith('/') ? value.slice(1).toLowerCase() : '';
  const filteredCommands = query
    ? slashCommands.filter((c) => c.name.startsWith(query))
    : slashCommands;

  // Filter mentions based on current @ context
  const mentionCtx = getMentionContext();
  const filteredMentions = mentionCtx.active
    ? mentionItems.filter((m) => m.label.toLowerCase().includes(mentionCtx.query))
    : [];

  // Show/hide command panel
  useEffect(() => {
    const shouldShow = value.startsWith('/') && filteredCommands.length > 0;
    setShowCommands(shouldShow);
    setSelectedCmd(0);
    if (shouldShow) updatePopupPos();
  }, [value, filteredCommands.length, updatePopupPos]);

  // Show/hide mention panel
  useEffect(() => {
    const shouldShow = mentionCtx.active && filteredMentions.length > 0;
    setShowMentions(shouldShow);
    setMentionCategoryIdx(0);
    setMentionItemIdx(0);
    setMentionPhase('category');
    if (shouldShow) updatePopupPos();
  }, [value, mentionCtx.active, filteredMentions.length, updatePopupPos]);

  // Scroll selected command into view
  useEffect(() => {
    if (showCommands) {
      document.getElementById(`cmd-item-${selectedCmd}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedCmd, showCommands]);

  // Scroll selected mention category / item into view
  useEffect(() => {
    if (!showMentions) return;
    if (mentionPhase === 'category') {
      document.getElementById(`mention-cat-${mentionCategoryIdx}`)?.scrollIntoView({ block: 'nearest' });
    } else {
      document.getElementById(`mention-item-${mentionItemIdx}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [showMentions, mentionPhase, mentionCategoryIdx, mentionItemIdx]);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const fn = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [showAttachMenu]);

  // Build mention category groups from filtered items
  const mentionGroups = React.useMemo(() => buildMentionGroups(filteredMentions), [filteredMentions]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const applyHistoryValue = useCallback((nextValue: string) => {
    setValue(nextValue);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextValue.length, nextValue.length);
      resizeTextarea();
    });
  }, [resizeTextarea]);

  const resetHistoryNavigation = useCallback(() => {
    setHistoryIndex(null);
    setDraftBeforeHistory('');
  }, []);

  const isCaretOnFirstLine = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart !== textarea.selectionEnd) return false;
    return value.lastIndexOf('\n', textarea.selectionStart - 1) === -1;
  }, [value]);

  const isCaretOnLastLine = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart !== textarea.selectionEnd) return false;
    return value.indexOf('\n', textarea.selectionEnd) === -1;
  }, [value]);

  const navigateInputHistory = useCallback((direction: 'previous' | 'next') => {
    if (inputHistory.length === 0) return false;

    if (direction === 'previous') {
      const nextIndex = historyIndex === null
        ? inputHistory.length - 1
        : Math.max(0, historyIndex - 1);
      if (historyIndex === null) setDraftBeforeHistory(value);
      setHistoryIndex(nextIndex);
      applyHistoryValue(inputHistory[nextIndex]);
      return true;
    }

    if (historyIndex === null) return false;
    if (historyIndex < inputHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      applyHistoryValue(inputHistory[nextIndex]);
      return true;
    }

    setHistoryIndex(null);
    applyHistoryValue(draftBeforeHistory);
    setDraftBeforeHistory('');
    return true;
  }, [applyHistoryValue, draftBeforeHistory, historyIndex, inputHistory, value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && images.length === 0) || disabled || isStreaming) return;

    // Check if it's a slash command
    if (trimmed.startsWith('/') && slashCommands.length > 0) {
      const cmdName = trimmed.slice(1).split(' ')[0];
      const cmd = slashCommands.find((c) => c.name === cmdName);
      if (cmd) {
        cmd.action();
        setValue('');
        resetHistoryNavigation();
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
    }

    onSend(trimmed, images.length > 0 ? images : undefined);
    setValue('');
    setImages([]);
    setShowCommands(false);
    setShowMentions(false);
    resetHistoryNavigation();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, images, disabled, isStreaming, onSend, slashCommands, resetHistoryNavigation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navigate command list
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCmd((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCmd((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const cmd = filteredCommands[selectedCmd];
        if (cmd) {
          setValue(`/${cmd.name} `);
          setShowCommands(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    // Navigate mention — two-layer selector
    if (showMentions && filteredMentions.length > 0) {
      // Build category groups for navigation
      const mentionGroups = buildMentionGroups(filteredMentions);
      const currentGroup = mentionGroups[mentionCategoryIdx];
      const currentItems = currentGroup?.items ?? [];

      if (mentionPhase === 'category') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionCategoryIdx((i) => Math.min(i + 1, mentionGroups.length - 1));
          setMentionItemIdx(0);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionCategoryIdx((i) => Math.max(i - 1, 0));
          setMentionItemIdx(0);
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (currentItems.length > 0) {
            setMentionPhase('items');
            setMentionItemIdx(0);
          }
          return;
        }
        if (e.key === 'Escape') {
          setShowMentions(false);
          return;
        }
      } else {
        // mentionPhase === 'items'
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionItemIdx((i) => Math.min(i + 1, currentItems.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionItemIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'Escape') {
          e.preventDefault();
          if (e.key === 'ArrowLeft') {
            setMentionPhase('category');
          } else {
            setShowMentions(false);
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          // Switch to next category
          if (mentionCategoryIdx < mentionGroups.length - 1) {
            setMentionCategoryIdx((i) => i + 1);
            setMentionItemIdx(0);
          }
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          const item = currentItems[mentionItemIdx];
          if (item && onMentionSelect) {
            const insertText = onMentionSelect(item);
            const before = value.slice(0, mentionCtx.start);
            const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
            setValue(before + insertText + ' ' + after);
          }
          setShowMentions(false);
          return;
        }
      }
    }

    const isComposing = (e.nativeEvent as KeyboardEvent).isComposing;
    const hasModifier = e.shiftKey || e.altKey || e.ctrlKey || e.metaKey;
    if (!isComposing && !hasModifier && e.key === 'ArrowUp' && isCaretOnFirstLine()) {
      if (navigateInputHistory('previous')) {
        e.preventDefault();
        return;
      }
    }
    if (!isComposing && !hasModifier && e.key === 'ArrowDown' && isCaretOnLastLine()) {
      if (navigateInputHistory('next')) {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    resetHistoryNavigation();
  };

  const handleInput = () => {
    resizeTextarea();
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, Math.max(0, MAX_IMAGE_ATTACHMENTS - images.length));
    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = (e.target?.result as string).split(',')[1]; // strip data:...;base64,
        if (data) {
          setImages((prev) => [...prev, { data, mimeType: file.type }]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [images.length]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) processFiles(imageFiles);
  }, [processFiles]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'mx-4 mb-4 rounded-2xl border bg-[#1c1c1c] transition-shadow relative shrink-0',
        dragOver ? 'border-blue-400 shadow-lg ring-2 ring-blue-200' :
        focused ? 'border-[#333] shadow-lg' : 'border-[#2a2a2a] shadow-md',
        disabled && 'opacity-60',
        className,
      )}
    >
      {/* Slash command autocomplete */}
      {showCommands && (
        <div
          style={{ position: 'fixed', left: popupPos.left, bottom: popupPos.bottom, width: popupPos.width, zIndex: 9999 }}
          className="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] shadow-xl py-1 max-h-64 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            {t('chat.commands')}
          </div>
          {filteredCommands.map((cmd, i) => (
            <button
              id={`cmd-item-${i}`}
              key={cmd.name}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                cmd.action();
                setValue('');
                setShowCommands(false);
                if (textareaRef.current) textareaRef.current.style.height = 'auto';
              }}
              onMouseEnter={() => setSelectedCmd(i)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-center gap-3 transition-colors',
                i === selectedCmd ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]',
              )}
            >
              <span className="text-xs font-mono text-cyan-600 flex-shrink-0">/{cmd.name}</span>
              <span className="text-xs text-gray-500">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mention (@) autocomplete — two-layer: categories | items */}
      {showMentions && mentionGroups.length > 0 && (() => {
        const currentGroup = mentionGroups[mentionCategoryIdx] ?? mentionGroups[0];
        return (
          <div
            style={{ position: 'fixed', left: popupPos.left, bottom: popupPos.bottom, width: popupPos.width, zIndex: 9999 }}
            className="flex bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] shadow-xl max-h-72 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Left: category list */}
            <div className="w-28 border-r border-[#2a2a2a] py-1 overflow-y-auto flex-shrink-0">
              {mentionGroups.map((group, gi) => (
                <button
                  id={`mention-cat-${gi}`}
                  key={group.key}
                  onMouseEnter={() => {
                    setMentionCategoryIdx(gi);
                    setMentionItemIdx(0);
                    setMentionPhase('category');
                  }}
                  onClick={() => {
                    setMentionCategoryIdx(gi);
                    setMentionItemIdx(0);
                    setMentionPhase('items');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-1.5 transition-colors',
                    gi === mentionCategoryIdx
                      ? 'bg-[#2a2a2a] text-gray-100'
                      : 'text-gray-500 hover:bg-[#222] hover:text-gray-300',
                  )}
                >
                  <span className="text-[10px]">{group.icon}</span>
                  <span>{group.title}</span>
                  <span className="text-[9px] text-gray-600 ml-auto">{group.items.length}</span>
                </button>
              ))}
            </div>
            {/* Right: items for selected category */}
            <div className="flex-1 py-1 overflow-y-auto min-w-0">
              {currentGroup.items.map((item, ii) => (
                <button
                  id={`mention-item-${ii}`}
                  key={`${item.category}-${item.label}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseEnter={() => {
                    setMentionItemIdx(ii);
                    setMentionPhase('items');
                  }}
                  onClick={() => {
                    if (onMentionSelect) {
                      const insertText = onMentionSelect(item);
                      const before = value.slice(0, mentionCtx.start);
                      const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
                      setValue(before + insertText + ' ' + after);
                    }
                    setShowMentions(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition-colors',
                    mentionPhase === 'items' && ii === mentionItemIdx ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]',
                  )}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span className="text-xs text-gray-200 flex-shrink-0 truncate max-w-[140px]">{item.label}</span>
                  {item.description && <span className="text-[10px] text-gray-500 truncate flex-1">{item.description}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Textarea row */}
      <div className="flex items-end gap-2 px-4 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={placeholder ?? t('chat.inputPlaceholder')}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100',
            'focus:outline-none',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'disabled:cursor-not-allowed',
            'max-h-[200px]',
          )}
        />
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {images.map((img, i) => (
            <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#222]">
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={`Attachment ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center hover:bg-black/70"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar: + menu + leading slot (model + controls) + spacer + send */}
      <div className="flex items-center gap-1.5 px-3 pb-3">
        {/* "+" attach button */}
        <div ref={attachMenuRef} className="relative flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; setShowAttachMenu(false); }}
            className="hidden"
          />
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={disabled}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] transition-colors disabled:opacity-30"
            title="引用"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-40 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-[60] py-1">
              <button
                onClick={() => { fileInputRef.current?.click(); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-[#252525] hover:text-gray-200 flex items-center gap-2 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>上传图片</span>
              </button>
              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  if (onFileReference) {
                    onFileReference();
                  } else {
                    fileRefInputRef.current?.click();
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-[#252525] hover:text-gray-200 flex items-center gap-2 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>引用文件</span>
              </button>
            </div>
          )}
          {/* Hidden file reference input (fallback when no onFileReference) */}
          <input
            ref={fileRefInputRef}
            type="file"
            accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.java,.go,.rs,.c,.cpp,.h,.yml,.yaml,.xml,.toml,.ini,.cfg,.sh,.bash,.sql,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
	                reader.onload = (ev) => {
	                  const text = ev.target?.result as string;
	                  if (text) {
	                    const truncated = text.length > MAX_INLINE_FILE_CHARS;
	                    const inlineText = truncated ? text.slice(0, MAX_INLINE_FILE_CHARS) : text;
	                    const prefix = value ? '\n' : '';
	                    setValue(prefix + `📄 ${file.name}${truncated ? ' (truncated)' : ''}\n\`\`\`\n${inlineText}\n\`\`\`${truncated ? '\n[File truncated in the input preview.]' : ''}`);
	                    textareaRef.current?.focus();
	                  }
                };
                reader.readAsText(file);
              }
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>

        {/* Leading slot: model selector + permission controls — all inline */}
        {leadingSlot}

        <div className="flex-1" />

        {/* Send / Stop button */}
        {isStreaming && onAbort ? (
          <button
            onClick={onAbort}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-all"
            title="Stop"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
            </svg>
          </button>
        ) : (
	          <button
	            onClick={handleSend}
	            disabled={disabled || isStreaming || (!value.trim() && images.length === 0)}
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
              'bg-gray-100 text-gray-900 hover:bg-gray-200',
              'dark:bg-[#333] dark:text-gray-200 dark:hover:bg-[#444]',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'transition-all',
            )}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8L14 2L8 14L7 9L2 8Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {trailingSlot}
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────

interface MentionGroup {
  key: string;
  title: string;
  icon: string;
  items: MentionItem[];
}

function buildMentionGroups(items: MentionItem[]): MentionGroup[] {
  const categoryOrder: Array<{ key: string; title: string; icon: string }> = [
    { key: 'file', title: '文件', icon: '📄' },
    { key: 'folder', title: '文件夹', icon: '📁' },
    { key: 'tool', title: '工具', icon: '⚙️' },
    { key: 'skill', title: '技能', icon: '✦' },
  ];
  const groups: MentionGroup[] = [];
  for (const cat of categoryOrder) {
    const catItems = items.filter((m) => m.category === cat.key);
    if (catItems.length > 0) groups.push({ key: cat.key, title: cat.title, icon: cat.icon, items: catItems });
  }
  // Items without category → fallback group
  const uncategorized = items.filter((m) => !m.category);
  if (uncategorized.length > 0 && groups.length === 0) {
    groups.push({ key: 'other', title: '引用', icon: '📎', items: uncategorized });
  }
  return groups;
}
