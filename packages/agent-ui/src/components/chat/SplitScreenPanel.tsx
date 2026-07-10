import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@svton/ui';
import { MarkdownRenderer } from './MarkdownRenderer';
import { sanitizeHtml } from '../../lib/sanitize';

export type SplitScreenContent =
  | { type: 'document'; title: string; content: string }
  | { type: 'code'; title: string; code: string; language?: string }
  | { type: 'pdf'; title: string; images: string[]; currentPage?: number }
  | { type: 'image'; title: string; src: string; alt?: string }
  | { type: 'preview_images'; title: string; images: string[] };

export interface SplitScreenPanelProps {
  content: SplitScreenContent | null;
  onClose: () => void;
  className?: string;
}

/**
 * Right-side split-screen panel — Doubao pattern.
 * Shows document preview or code preview alongside the chat.
 */
export function SplitScreenPanel({ content, onClose, className }: SplitScreenPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [editContent, setEditContent] = useState('');

  // Sync edit state when content changes
  useEffect(() => {
    if (content?.type === 'document') {
      setEditContent(content.content);
    } else if (content?.type === 'code') {
      setEditContent(content.code);
    } else {
      setEditContent('');
    }
    setMode('preview');
  }, [content]);

  // Write code to iframe for code preview
  useEffect(() => {
    if (!content || content.type !== 'code' || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const lang = content.language?.toLowerCase() ?? '';
    let html: string;
    if (lang === 'html' || lang === 'jsx' || lang === 'tsx') {
      html = content.code;
    } else if (lang === 'css') {
      html = `<!DOCTYPE html><html><head><style>${content.code}</style></head><body><div class="preview" style="padding:20px;font-family:sans-serif;color:#ccc;background:#1c1c1c">CSS Preview</div></body></html>`;
    } else {
      html = `<!DOCTYPE html><html><head><style>body{font-family:monospace;font-size:13px;padding:16px;color:#ccc;background:#1c1c1c}.log{padding:4px 0;border-bottom:1px solid #2a2a2a}.err{color:#ef4444}.warn{color:#f59e0b}</style></head><body><script>
(function(){var _l=console.log,_e=console.error,_w=console.warn;
function a(t,c){var d=document.createElement('div');d.className='log';d.style.color=c;d.textContent=String(t);document.body.appendChild(d)}
console.log=function(){for(var i=0;i<arguments.length;i++)a(arguments[i],'#ccc');_l.apply(console,arguments)};
console.error=function(){for(var i=0;i<arguments.length;i++)a(arguments[i],'#ef4444');_e.apply(console,arguments)};
console.warn=function(){for(var i=0;i<arguments.length;i++)a(arguments[i],'#f59e0b');_w.apply(console,arguments)};
try{${content.code}}catch(e){a('Error: '+e.message,'#ef4444')}})();
</script></body></html>`;
    }
    doc.open();
    doc.write(html);
    doc.close();
  }, [content, mode]);

  const handleExport = useCallback(() => {
    if (!content) return;
    if (content.type !== 'document' && content.type !== 'code') return;
    const text = content.type === 'document' ? content.content : content.code;
    const ext = content.type === 'code' ? (content.language === 'html' ? 'html' : content.language === 'css' ? 'css' : 'js') : 'md';
    const mimeType = 'text/plain';
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  if (!content) return null;

  return (
    <div className={cn(
      'flex flex-col h-full bg-[#2a2a2a] border-l border-[#383838] shadow-lg',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#383838]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-200 truncate">
            {content.title}
          </span>
          <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2a2a2a] text-gray-500 uppercase">
            {content.type === 'code' ? (content.language || 'CODE') : content.type === 'pdf' ? 'PDF' : content.type === 'image' ? 'IMG' : content.type === 'preview_images' ? 'PREVIEW' : 'MD'}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Mode toggle — only for document/code */}
          {(content.type === 'document' || content.type === 'code') && (
          <div className="flex items-center bg-[#2a2a2a] rounded-lg p-0.5">
            <button
              onClick={() => setMode('preview')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors',
                mode === 'preview' ? 'bg-[#333] text-gray-200' : 'text-gray-500 hover:text-gray-300',
              )}
            >
              Preview
            </button>
            <button
              onClick={() => setMode('edit')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors',
                mode === 'edit' ? 'bg-[#333] text-gray-200' : 'text-gray-500 hover:text-gray-300',
              )}
            >
              Edit
            </button>
          </div>
          )}

          {/* Export — only for text-based content */}
          {(content.type === 'document' || content.type === 'code') && (
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a] transition-colors"
            title="Export"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
              <polyline points="5 6 8 9 11 6" />
              <line x1="8" y1="2" x2="8" y2="9" />
            </svg>
          </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a] transition-colors"
            aria-label="Close panel"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {content.type === 'document' && mode === 'preview' && (
          <div className="p-6 max-w-none text-gray-200">
            <MarkdownRenderer content={editContent} />
          </div>
        )}

        {content.type === 'document' && mode === 'edit' && (
          <div className="h-full flex flex-col">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 w-full p-4 text-sm font-mono text-gray-300 bg-[#171717] resize-none outline-none"
              placeholder="Edit content..."
            />
            <div className="px-4 py-2 border-t border-[#383838] text-[11px] text-gray-600">
              {editContent.length} characters
            </div>
          </div>
        )}

        {content.type === 'code' && mode === 'preview' && (
          <iframe
            ref={iframeRef}
            sandbox="allow-scripts"
            className="w-full h-full border-none bg-[#2a2a2a]"
            title={content.title}
          />
        )}

        {content.type === 'code' && mode === 'edit' && (
          <div className="h-full flex flex-col">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 w-full p-4 text-sm font-mono text-gray-300 bg-[#171717] resize-none outline-none"
              placeholder="Edit code..."
              spellCheck={false}
            />
          </div>
        )}

        {/* PDF preview — render page images */}
        {content.type === 'pdf' && (
          <div className="h-full overflow-auto bg-[#2a2a2a] p-4 flex flex-col items-center gap-3">
            {content.images.length === 0 ? (
              <p className="text-gray-500 text-sm mt-8">PDF 渲染失败。请确认系统已安装 poppler-utils。</p>
            ) : content.images.map((img, i) => (
              <img
                key={i}
                src={`data:image/png;base64,${img}`}
                alt={`Page ${i + 1}`}
                className="max-w-full shadow-lg border border-[#3a3a3a] rounded"
              />
            ))}
          </div>
        )}

        {/* Image preview */}
        {content.type === 'image' && (
          <div className="h-full overflow-auto bg-[#2a2a2a] flex items-center justify-center p-4">
            <img
              src={content.src.startsWith('data:') ? content.src : `data:image/png;base64,${content.src}`}
              alt={content.alt || content.title}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {/* Preview images (Excel/PPTX rendered as images) */}
        {content.type === 'preview_images' && (
          <div className="h-full overflow-auto bg-[#2a2a2a] p-4 flex flex-col items-center gap-3">
            {content.images.map((img, i) => (
              <img
                key={i}
                src={img.startsWith('data:') ? img : `data:image/png;base64,${img}`}
                alt={`Preview ${i + 1}`}
                className="max-w-full shadow-lg border border-[#3a3a3a] rounded"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
