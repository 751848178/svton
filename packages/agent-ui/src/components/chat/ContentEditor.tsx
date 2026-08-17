'use client';

import React, { useState, useCallback } from 'react';
import { CloseIcon, useI18n } from '@svton/ui';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ExportManager } from './ExportManager';

export interface ContentEditorProps {
  /** Initial markdown content */
  content: string;
  /** Title for export */
  title?: string;
  /** Callback when editor closes */
  onClose: () => void;
  /** Callback when content changes */
  onSave?: (content: string) => void;
}

type ViewMode = 'edit' | 'preview';

/**
 * Inline content editor for AI-generated content.
 * - Edit mode: raw markdown textarea
 * - Preview mode: rendered markdown
 * - Export: download as .md / .txt / .html
 */
export function ContentEditor({ content: initialContent, title, onClose, onSave }: ContentEditorProps) {
  const { translate: t } = useI18n();
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<ViewMode>('preview');
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(content);
    setHasChanges(false);
  }, [content, onSave]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-label={title || t('editor.title')}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-foreground">
              {title || t('editor.title')}
            </h3>
            {hasChanges && (
              <span className="text-xs font-medium text-status-warning">{t('editor.unsaved')}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                onClick={() => setMode('edit')}
                className={`min-h-11 min-w-11 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mode === 'edit' ? 'bg-accent text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('action.edit')}
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`min-h-11 min-w-11 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mode === 'preview' ? 'bg-accent text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('action.preview')}
              </button>
            </div>

            {/* Export */}
            <ExportManager content={content} title={title}>
              {(onClick) => (
                <button
                  onClick={onClick}
                  className="min-h-11 min-w-11 rounded-lg bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('action.export')}
                </button>
              )}
            </ExportManager>

            {/* Save (only when changed) */}
            {hasChanges && onSave && (
              <button
                onClick={handleSave}
                className="min-h-11 min-w-11 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors"
              >
                {t('editor.save')}
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={t('editor.close')}
            >
              <CloseIcon size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {mode === 'edit' ? (
            <textarea
              value={content}
              onChange={handleChange}
              className="h-full min-h-[400px] w-full resize-none bg-card p-6 font-mono text-sm leading-relaxed text-foreground focus:outline-none"
              placeholder={t('editor.placeholder')}
              spellCheck={false}
            />
          ) : (
            <div className="p-6">
              <MarkdownRenderer content={content} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
          <span>{content.length} {t('editor.characters')}</span>
          <span>Markdown</span>
        </div>
      </div>
    </div>
  );
}
