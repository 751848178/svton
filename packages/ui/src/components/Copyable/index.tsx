import React, { useState, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface CopyableProps {
  text: string;
  children?: ReactNode;
  onCopy?: (text: string) => void;
  onError?: (error: Error) => void;
  copiedText?: ReactNode;
  copyText?: ReactNode;
  timeout?: number;
  className?: string;
}

export function Copyable(props: CopyableProps) {
  const { text, children, onCopy, onError, copiedText = 'Copied!', copyText = 'Copy', timeout = 2000, className } = props;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.(text);
      setTimeout(() => setCopied(false), timeout);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Copy failed'));
    }
  }, [text, onCopy, onError, timeout]);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {children ?? <span className="font-mono">{text}</span>}
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border transition-colors',
          copied
            ? 'text-green-500 border-green-500'
            : 'text-black/60 border-black/15 hover:border-black/30'
        )}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        {copied ? copiedText : copyText}
      </button>
    </span>
  );
}
