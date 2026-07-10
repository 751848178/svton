import React, { useState, useMemo } from 'react';
import { cn } from '@svton/ui';
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
}

/**
 * Codex-style code block: dark background, language label, copy button.
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
}) => {
  const [copied, setCopied] = useState(false);

  if (inline) {
    return (
      <code className={cn(
        'bg-[#2a2a2a] text-gray-300 px-1.5 py-0.5 rounded text-[13px] font-mono',
        className,
      )}>
        {code}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
    }
  };

  const label = filename || language || '';
  const canPreview = isPreviewable(language) && !!onPreview;

  // Syntax highlighting — uses the shared ESM hljs instance (not CJS require).
  const highlightedHtml = useMemo(() => {
    if (!highlight || !language) return null;
    try {
      const result = hljs.highlight(code, { language });
      return result.value;
    } catch {
      return null;
    }
  }, [code, language, highlight]);

  return (
    <div className={cn('rounded-lg overflow-hidden my-3 bg-[#1a1a1a]', className)}>
      {/* Header bar */}
      {(label || canPreview) && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#161b22]">
          <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
            {label}
          </span>
          <div className="flex items-center gap-2">
            {canPreview && (
              <button
                onClick={() => onPreview!(code, language)}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                Preview
              </button>
            )}
            <button
              onClick={handleCopy}
              className={cn(
                'text-[11px] transition-colors',
                copied ? 'text-green-400' : 'text-gray-500 hover:text-gray-300',
              )}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Code content */}
      <div className="relative group">
        {!label && !canPreview && (
          <button
            onClick={handleCopy}
            className={cn(
              'absolute top-2 right-2 text-[11px] transition-opacity',
              copied ? 'opacity-100 text-green-400' : 'opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300',
            )}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
        <pre className="px-4 py-3 overflow-x-auto max-h-96 overflow-y-auto">
          {highlightedHtml ? (
            <code
              className="text-xs font-mono leading-5 hljs"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightedHtml) }}
            />
          ) : (
            <code className="text-xs font-mono leading-5 text-gray-100">
              {code}
            </code>
          )}
        </pre>
      </div>
    </div>
  );
};
