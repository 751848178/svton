import React, { useState, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { CheckIcon, CopyIcon } from '../../icons';
import { useI18n } from '../../i18n';

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
  const { translate } = useI18n();
  const { text, children, onCopy, onError, copiedText = translate('action.copied'), copyText = translate('action.copy'), timeout = 2000, className } = props;
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
            ? 'text-success border-success'
            : 'text-muted-foreground border-border hover:border-foreground/40'
        )}
      >
        {copied
          ? <CheckIcon size={14} aria-hidden="true" />
          : <CopyIcon size={14} aria-hidden="true" />}
        {copied ? copiedText : copyText}
      </button>
    </span>
  );
}
