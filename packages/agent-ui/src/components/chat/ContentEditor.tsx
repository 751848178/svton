'use client';

import React, { useState, useCallback } from 'react';
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
 * Follows the Doubao pattern: Chat → Edit → Export.
 *
 * - Edit mode: raw markdown textarea
 * - Preview mode: rendered markdown
 * - Export: download as .md / .txt / .html
 */
export function ContentEditor({ content: initialContent, title, onClose, onSave }: ContentEditorProps) {
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
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#2a2a2a] rounded-xl shadow-2xl flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#383838]">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-100">
              {title || 'Content Editor'}
            </h3>
            {hasChanges && (
              <span className="text-xs text-orange-500 font-medium">Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex bg-[#2a2a2a] rounded-lg p-0.5">
              <button
                onClick={() => setMode('edit')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  mode === 'edit' ? 'bg-[#333] shadow text-gray-100' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  mode === 'preview' ? 'bg-[#333] shadow text-gray-100' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Preview
              </button>
            </div>

            {/* Export */}
            <ExportManager content={content} title={title}>
              {(onClick) => (
                <button
                  onClick={onClick}
                  className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-gray-200 bg-[#2a2a2a] rounded-lg transition-colors"
                >
                  Export
                </button>
              )}
            </ExportManager>

            {/* Save (only when changed) */}
            {hasChanges && onSave && (
              <button
                onClick={handleSave}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
              aria-label="Close editor"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {mode === 'edit' ? (
            <textarea
              value={content}
              onChange={handleChange}
              className="w-full h-full min-h-[400px] p-6 text-sm font-mono leading-relaxed text-gray-100 resize-none focus:outline-none"
              placeholder="Edit content..."
              spellCheck={false}
            />
          ) : (
            <div className="p-6">
              <MarkdownRenderer content={content} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>{content.length} chars</span>
          <span>Markdown</span>
        </div>
      </div>
    </div>
  );
}
