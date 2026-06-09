import React from 'react';
import { cn } from '@svton/ui';

export type DocumentKind = 'document' | 'code' | 'report';

export interface DocumentCardProps {
  /** Document title (first heading or filename) */
  title: string;
  /** Short preview snippet of the content */
  snippet: string;
  /** Type of document — affects icon */
  kind?: DocumentKind;
  /** File extension label */
  extension?: string;
  /** Click handler — should open split-screen preview */
  onClick: () => void;
  className?: string;
}

const KIND_ICON: Record<DocumentKind, { icon: string; bg: string; label: string }> = {
  document: { icon: '📄', bg: 'bg-blue-900/30', label: 'DOC' },
  code: { icon: '💻', bg: 'bg-purple-900/30', label: 'CODE' },
  report: { icon: '📊', bg: 'bg-green-900/30', label: 'REPORT' },
};

/**
 * File reference card shown in chat messages — Doubao pattern.
 * Displays as a compact clickable card with icon, title, and snippet.
 * Clicking opens the split-screen preview panel.
 */
export function DocumentCard({ title, snippet, kind = 'document', extension, onClick, className }: DocumentCardProps) {
  const meta = KIND_ICON[kind];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 w-full text-left px-4 py-3 rounded-xl',
        'border border-[#2a2a2a] bg-[#1c1c1c] hover:bg-[#222] hover:border-[#333]',
        'transition-all duration-150 group',
        className,
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg', meta.bg)}>
        {meta.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200 truncate">{title}</span>
          {extension && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2a2a2a] text-gray-500 uppercase">
              {extension}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{snippet}</p>
      </div>

      {/* Open indicator */}
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        className="flex-shrink-0 text-gray-500 group-hover:text-gray-300 transition-colors mt-1"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M6 4l4 4-4 4" />
      </svg>
    </button>
  );
}

/**
 * Detect if AI content is a "document generation" output that should show as a card.
 * Returns metadata for the card, or null if it's a regular message.
 */
export function detectDocumentContent(content: string): { title: string; snippet: string; kind: DocumentKind; extension: string } | null {
  // Must be long enough to be a document (not a regular answer with headings)
  if (content.length < 800) return null;

  // Check for markdown document structure: has a top-level heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (!titleMatch) return null;

  const title = titleMatch[1].trim();
  const headingCount = (content.match(/^#{1,3}\s+/gm) || []).length;

  // Must have at least 3 headings to be considered a structured document
  if (headingCount < 3) return null;

  // Must have at least 30 lines — real documents are substantial
  if (content.split('\n').length < 30) return null;

  // Extract snippet: first paragraph after the title
  const lines = content.split('\n');
  let snippetLines: string[] = [];
  let started = false;
  for (const line of lines) {
    if (line.startsWith('# ') && !started) { started = true; continue; }
    if (started && line.trim() && !line.startsWith('#')) {
      snippetLines.push(line.trim());
      if (snippetLines.length >= 2) break;
    }
    if (started && line.startsWith('# ') && snippetLines.length > 0) break;
  }
  const snippet = snippetLines.join(' ').slice(0, 120);

  // Determine kind
  const hasCode = content.includes('```');
  const kind: DocumentKind = hasCode ? 'code' : headingCount >= 3 ? 'report' : 'document';
  const extension = hasCode ? 'MD' : 'MD';

  return { title, snippet, kind, extension };
}
