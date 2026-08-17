'use client';

import React, { useMemo } from 'react';
import { FileIcon, useI18n } from '@svton/ui';
import { sanitizeHtml } from '../../lib/sanitize';
import { TimelineStatusIcon } from '../timeline/TimelineStatusIcon';

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
 * - Progress indicator during generation
 * - Table of contents navigation
 * - Source citations
 * - Exportable content
 */
export function ResearchReport({ title, content, phase = 'complete', sources, className }: ResearchReportProps) {
  const { translate: t } = useI18n();
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
    <div className={`my-4 overflow-hidden rounded-xl border border-border bg-card ${className || ''}`}>
      {/* Header */}
      <div className="border-b border-border bg-muted px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <FileIcon size={16} className="text-status-info" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wide text-status-info">{t('research.report')}</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>

      <div className="flex">
        {/* Sidebar — Table of Contents */}
        {headings.length > 2 && (
          <nav className="hidden w-48 flex-shrink-0 border-r border-border bg-muted p-4 md:block">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('research.contents')}</div>
            <ul className="space-y-1">
              {headings.map((h, i) => (
                <li key={i}>
                  <a
                    href={`#${h.id}`}
                    className={`block truncate text-xs text-muted-foreground transition-colors hover:text-status-info ${
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
            className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToSimpleHTML(processedContent)) }}
          />
        </div>
      </div>

      {/* Sources */}
      {sources && sources.length > 0 && (
        <div className="border-t border-border bg-muted px-6 py-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('research.sources')}</div>
          <div className="flex flex-wrap gap-2">
            {sources.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-status-info hover:underline">
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
  const { translate: t } = useI18n();
  const phases = [
    { key: 'searching', label: t('research.searching') },
    { key: 'analyzing', label: t('research.analyzing') },
    { key: 'generating', label: t('research.generating') },
  ];

  const currentIndex = phases.findIndex((p) => p.key === phase);

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted px-6 py-4">
        <div className="flex items-center gap-2">
          <TimelineStatusIcon status="running" size={16} />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-center gap-4">
          {phases.map((p, i) => (
            <React.Fragment key={p.key}>
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  i < currentIndex ? 'bg-status-success/10' :
                  i === currentIndex ? 'bg-status-info/10' :
                  'bg-muted'
                }`}>
                  {i <= currentIndex
                    ? <TimelineStatusIcon status={i < currentIndex ? 'completed' : 'running'} />
                    : i + 1}
                </div>
                <span className={`text-xs ${
                  i <= currentIndex ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}>
                  {p.label}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div className={`h-px flex-1 ${i < currentIndex ? 'bg-status-success' : 'bg-border'}`} />
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
