'use client';

import React, { useMemo } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';

export interface ResearchReportProps {
  /** Report title */
  title: string;
  /** Report content in markdown */
  content: string;
  /** Generation progress phase */
  phase?: 'searching' | 'analyzing' | 'generating' | 'complete';
  /** Sources referenced */
  sources?: Array<{ title: string; url?: string }>;
  className?: string;
}

/**
 * Structured research report component.
 * Follows the Doubao "Deep Research" pattern:
 * - Progress indicator during generation
 * - Table of contents navigation
 * - Source citations
 * - Exportable content
 */
export function ResearchReport({ title, content, phase = 'complete', sources, className }: ResearchReportProps) {
  // Extract headings for table of contents
  const headings = useMemo(() => {
    const lines = content.split('\n');
    return lines
      .filter((l) => /^#{1,3}\s+/.test(l))
      .map((line) => {
        const level = line.match(/^(#+)/)?.[1].length || 1;
        const text = line.replace(/^#+\s+/, '').trim();
        const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, '');
        return { level, text, id };
      });
  }, [content]);

  // Add IDs to headings in content
  const processedContent = useMemo(() => {
    return content.replace(/^(#{1,3})\s+(.+)$/gm, (_, hashes, text) => {
      const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, '');
      return `${hashes} <a id="${id}"></a>${text}`;
    });
  }, [content]);

  if (phase !== 'complete') {
    return <ResearchProgress phase={phase} title={title} />;
  }

  return (
    <div className={`rounded-xl border border-[#383838] bg-[#2a2a2a] overflow-hidden my-4 ${className || ''}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-[#1a1a1a] border-b border-[#383838]">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-xs text-blue-600 font-medium uppercase tracking-wide">Research Report</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="flex">
        {/* Sidebar — Table of Contents */}
        {headings.length > 2 && (
          <nav className="hidden md:block w-48 flex-shrink-0 p-4 border-r border-[#333] bg-[#1a1a1a]">
            <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">Contents</div>
            <ul className="space-y-1">
              {headings.map((h, i) => (
                <li key={i}>
                  <a
                    href={`#${h.id}`}
                    className={`text-xs text-gray-500 hover:text-blue-500 transition-colors block truncate ${
                      h.level === 2 ? 'pl-2' : h.level === 3 ? 'pl-4' : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Main content */}
        <div className="flex-1 px-6 py-4 min-w-0">
          <div
            className="prose prose-sm max-w-none text-gray-300"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToSimpleHTML(processedContent)) }}
          />
        </div>
      </div>

      {/* Sources */}
      {sources && sources.length > 0 && (
        <div className="px-6 py-3 border-t border-[#333] bg-[#1a1a1a]">
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Sources</div>
          <div className="flex flex-wrap gap-2">
            {sources.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs text-gray-400 bg-[#2a2a2a] px-2 py-0.5 rounded">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                    [{i + 1}] {s.title}
                  </a>
                ) : (
                  <span>[{i + 1}] {s.title}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Research Progress ──────────────────────────────────────
function ResearchProgress({ phase, title }: { phase: string; title: string }) {
  const phases = [
    { key: 'searching', label: 'Searching', icon: '🔍' },
    { key: 'analyzing', label: 'Analyzing', icon: '📊' },
    { key: 'generating', label: 'Generating', icon: '✍️' },
  ];

  const currentIndex = phases.findIndex((p) => p.key === phase);

  return (
    <div className="rounded-xl border border-[#383838] bg-[#2a2a2a] overflow-hidden my-4">
      <div className="px-6 py-4 bg-[#1a1a1a] border-b border-[#383838]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-gray-300">{title}</span>
        </div>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-center gap-4">
          {phases.map((p, i) => (
            <React.Fragment key={p.key}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  i < currentIndex ? 'bg-green-100 text-green-600' :
                  i === currentIndex ? 'bg-blue-100 text-blue-600 animate-pulse' :
                  'bg-[#2a2a2a] text-gray-400'
                }`}>
                  {i < currentIndex ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${
                  i <= currentIndex ? 'text-gray-700 font-medium' : 'text-gray-400'
                }`}>
                  {p.label}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div className={`flex-1 h-px ${i < currentIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple markdown to HTML for report rendering.
 * Uses the same approach as ExportManager.
 */
function markdownToSimpleHTML(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 8px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:600;margin:20px 0 10px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:24px 0 12px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb;">$1</a>')
    .replace(/^[-*+]\s+(.+)$/gm, '<li style="margin:4px 0 4px 20px;">$1</li>')
    .replace(/^&gt;\s+(.+)$/gm, '<blockquote style="border-left:3px solid #d1d5db;padding-left:12px;color:#6b7280;margin:8px 0;">$1</blockquote>')
    .replace(/\n{2,}/g, '</p><p style="margin:8px 0;">')
    .replace(/\n/g, '<br>');
}
