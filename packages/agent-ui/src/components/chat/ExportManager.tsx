'use client';

import React, { useState, useCallback, type ReactNode } from 'react';

export type ExportFormat = 'markdown' | 'text' | 'html';

export interface ExportManagerProps {
  /** Markdown source content */
  content: string;
  /** Title for the exported file */
  title?: string;
  /** Trigger element (receives onClick) */
  children?: (onClick: () => void) => ReactNode;
  className?: string;
}

/**
 * Export AI-generated content to various formats.
 * Handles Markdown → .md, plain text → .txt, and HTML → .html downloads.
 * All processing is client-side using Blob + URL.createObjectURL.
 */
export function ExportManager({ content, title, children, className }: ExportManagerProps) {
  const [open, setOpen] = useState(false);

  const downloadFile = useCallback((data: string, filename: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  }, []);

  const exportMarkdown = useCallback(() => {
    const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    downloadFile(content, `${safeTitle}.md`, 'text/markdown;charset=utf-8');
  }, [content, title, downloadFile]);

  const exportText = useCallback(() => {
    // Strip markdown syntax for plain text
    const text = content
      .replace(/^#{1,6}\s+/gm, '')       // headings
      .replace(/\*\*(.*?)\*\*/g, '$1')    // bold
      .replace(/\*(.*?)\*/g, '$1')         // italic
      .replace(/`(.*?)`/g, '$1')           // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/^[-*+]\s+/gm, '- ')        // lists
      .replace(/^>\s+/gm, '')              // blockquotes
      .replace(/---/g, '')                 // hr
      .trim();
    const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    downloadFile(text, `${safeTitle}.txt`, 'text/plain;charset=utf-8');
  }, [content, title, downloadFile]);

  const exportHTML = useCallback(() => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || 'Document'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #1a1a1a; }
  h1, h2, h3, h4 { margin-top: 1.5em; margin-bottom: 0.5em; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1.25rem; } h3 { font-size: 1.1rem; }
  code { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre { background: #1e1e2e; color: #cdd6f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; margin: 1em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d1d5db; padding: 0.5em 1em; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  ul, ol { padding-left: 1.5em; }
  a { color: #2563eb; }
</style>
</head>
<body>
${markdownToBasicHTML(content)}
</body>
</html>`;
    const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    downloadFile(html, `${safeTitle}.html`, 'text/html;charset=utf-8');
  }, [content, title, downloadFile]);

  return (
    <div className="relative">
      {children ? children(() => setOpen(!open)) : (
        <button
          onClick={() => setOpen(!open)}
          className={`text-[11px] text-gray-500 hover:text-gray-300 transition-colors ${className || ''}`}
          aria-label="Export"
        >
          Export
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-50 min-w-[140px]">
          <button
            onClick={exportMarkdown}
            className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
          >
            Markdown (.md)
          </button>
          <button
            onClick={exportText}
            className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
          >
            Plain Text (.txt)
          </button>
          <button
            onClick={exportHTML}
            className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
          >
            HTML (.html)
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Basic Markdown to HTML conversion (no external deps).
 * For full rendering, use MarkdownRenderer component instead.
 */
function markdownToBasicHTML(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (```...```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Paragraphs (wrap remaining lines)
    .replace(/^(?!<[hublop]|<li|<hr|<pre|<code)(.+)$/gm, '<p>$1</p>');

  return html;
}
