import React, { useState, useMemo } from 'react';
import { cn, useI18n } from '@svton/ui';
import { sanitizeHtml } from '../../lib/sanitize';
import { hljs } from '../../lib/highlight-setup';

const PREVIEWABLE_LANGS = new Set(['html', 'css', 'javascript', 'js', 'jsx', 'ts', 'typescript']);

function isPreviewable(lang?: string): boolean {
  if (!lang) return false;
  return PREVIEWABLE_LANGS.has(lang.toLowerCase());
}

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  /** If true, render inline code instead of a block */
  inline?: boolean;
  /** If true, apply syntax highlighting via highlight.js */
  highlight?: boolean;
  /** Called when user clicks "Preview" — parent should open split-screen view */
  onPreview?: (code: string, language?: string) => void;
  artifactTargetId?: string;
}

/**
 * Code block with a language label and keyboard-reachable actions.
 * For inline code, use inline={true}.
 * For syntax highlighting, use highlight={true} (requires highlight.js to be imported).
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  filename,
  inline,
  highlight,
  className,
  onPreview,
  artifactTargetId,
}) => {
  const { translate: t } = useI18n();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  // Syntax highlighting — uses the shared ESM hljs instance (not CJS require).
  // Keep this before the inline early return so prop changes preserve Hook order.
  const highlightedHtml = useMemo(() => {
    if (!highlight || !language) return null;
    try {
      const result = hljs.highlight(code, { language });
      return result.value;
    } catch {
      return null;
    }
  }, [code, language, highlight]);

  if (inline) {
    return (
      <code className={cn(
        'rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground',
        className,
      )}>
        {code}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('failed');
    }
  };

  const label = filename || language || '';
  const canPreview = isPreviewable(language) && !!onPreview;

  return (
    <div className={cn('my-3 overflow-hidden rounded-lg border border-border bg-card', className)}>
      {/* Header bar */}
      {(label || canPreview) && (
        <div className="flex items-center justify-between bg-muted px-4 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className="flex items-center gap-2">
            {canPreview && (
              <button
                onClick={() => onPreview!(code, language)}
                data-artifact-target-id={artifactTargetId}
                className="min-h-11 min-w-11 rounded-lg px-3 text-[11px] text-status-info transition-colors hover:bg-accent"
                aria-label={`${t('action.openContentPanel')}: ${label || t('chat.codeLabel')}`}
              >
                {t('action.preview')}
              </button>
            )}
            <button
              onClick={handleCopy}
              data-testid="code-copy-action"
              className={cn(
                'min-h-11 min-w-11 rounded-lg px-3 text-[11px] transition-[background-color]',
                copyStatus === 'copied' ? 'text-status-success' : copyStatus === 'failed' ? 'text-status-error' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {copyStatus === 'copied' ? t('action.copied') : copyStatus === 'failed' ? t('action.copyFailed') : t('action.copy')}
            </button>
          </div>
        </div>
      )}

      {/* Code content */}
      <div className="group/code relative">
        {!label && !canPreview && (
          <button
            onClick={handleCopy}
            data-testid="code-copy-action"
            className={cn(
              'pointer-events-none absolute right-2 top-2 min-h-11 min-w-11 rounded-lg bg-card px-3 text-[11px] opacity-0 transition-[background-color,opacity] focus-visible:pointer-events-auto focus-visible:opacity-100 group-focus-within/code:pointer-events-auto group-focus-within/code:opacity-100 group-hover/code:pointer-events-auto group-hover/code:opacity-100',
              copyStatus === 'copied' ? 'pointer-events-auto opacity-100 text-status-success' : copyStatus === 'failed' ? 'pointer-events-auto opacity-100 text-status-error' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {copyStatus === 'copied' ? t('action.copied') : copyStatus === 'failed' ? t('action.copyFailed') : t('action.copy')}
          </button>
        )}
        <pre className="px-4 py-3 overflow-x-auto max-h-96 overflow-y-auto">
          {highlightedHtml ? (
            <code
              className="text-xs font-mono leading-5 hljs"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightedHtml) }}
            />
          ) : (
            <code className="font-mono text-xs leading-5 text-foreground">
              {code}
            </code>
          )}
        </pre>
      </div>
    </div>
  );
};
