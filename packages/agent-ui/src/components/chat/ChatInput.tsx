import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn, t } from '@svton/ui';

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

export interface ChatInputProps {
  onSend: (content: string, images?: ImageAttachment[]) => void;
  /** Abort an in-progress streaming response */
  onAbort?: () => void;
  /** Whether the agent is currently streaming a response */
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Extra element rendered before the textarea (e.g. model selector) */
  leadingSlot?: React.ReactNode;
  /** Extra action buttons rendered after the send button */
  trailingSlot?: React.ReactNode;
  /** Footer row rendered at the bottom of the input card (e.g. project/mode/branch selectors) */
  footerSlot?: React.ReactNode;
  /** Available slash commands */
  slashCommands?: SlashCommand[];
  className?: string;
}

/**
 * Codex-style chat input: rounded card container, integrated controls.
 * Supports slash commands with autocomplete.
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onAbort,
  isStreaming,
  disabled,
  placeholder,
  leadingSlot,
  trailingSlot,
  footerSlot,
  slashCommands = [],
  className,
}) => {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCmd, setSelectedCmd] = useState(0);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter commands based on current input
  const query = value.startsWith('/') ? value.slice(1).toLowerCase() : '';
  const filteredCommands = query
    ? slashCommands.filter((c) => c.name.startsWith(query))
    : slashCommands;

  // Show/hide command panel
  useEffect(() => {
    setShowCommands(value.startsWith('/') && filteredCommands.length > 0);
    setSelectedCmd(0);
  }, [value, filteredCommands.length]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && images.length === 0) || disabled) return;

    // Check if it's a slash command
    if (trimmed.startsWith('/') && slashCommands.length > 0) {
      const cmdName = trimmed.slice(1).split(' ')[0];
      const cmd = slashCommands.find((c) => c.name === cmdName);
      if (cmd) {
        cmd.action();
        setValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
    }

    onSend(trimmed, images.length > 0 ? images : undefined);
    setValue('');
    setImages([]);
    setShowCommands(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, images, disabled, onSend, slashCommands]);

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

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
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
  }, []);

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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'mx-4 mb-4 rounded-2xl border bg-[#1c1c1c] transition-shadow relative',
        dragOver ? 'border-blue-400 shadow-lg ring-2 ring-blue-200' :
        focused ? 'border-[#333] shadow-lg' : 'border-[#2a2a2a] shadow-md',
        disabled && 'opacity-60',
        className,
      )}
    >
      {/* Slash command autocomplete */}
      {showCommands && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            {t('chat.commands')}
          </div>
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.name}
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

      {/* Textarea row */}
      <div className="flex items-end gap-2 px-4 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
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

      {/* Bottom bar: model selector + image upload + send */}
      <div className="flex items-center gap-2 px-4 pb-3">
        {leadingSlot}

        {/* Image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-300 hover:bg-[#222] transition-colors disabled:opacity-30"
          title="Attach image"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </button>

        <div className="flex-1" />

        {/* Send / Stop button */}
        {isStreaming && onAbort ? (
          <button
            onClick={onAbort}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-all"
            title="Stop"
          >
            {/* Stop icon: filled square */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || (!value.trim() && images.length === 0)}
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
              'bg-gray-100 text-gray-900 hover:bg-gray-200',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              'transition-all',
            )}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
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

      {/* Footer slot — e.g. project / mode / branch selectors */}
      {footerSlot && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-1.5">
          {footerSlot}
        </div>
      )}
    </div>
  );
};
