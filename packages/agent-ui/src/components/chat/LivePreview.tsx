'use client';

import React, { useState, useMemo } from 'react';

export interface LivePreviewProps {
  /** Source code to preview */
  code: string;
  /** Language of the code (html, css, js, etc.) */
  language?: string;
  className?: string;
}

/**
 * Live preview for generated HTML/CSS/JS code.
 * Renders the code in a sandboxed iframe.
 * Follows the Doubao AI programming pattern: code | preview split view.
 */
export function LivePreview({ code, language, className }: LivePreviewProps) {
  const [showCode, setShowCode] = useState(false);

  const iframeSrc = useMemo(() => {
    // If it's already a full HTML document, render as-is
    if (language === 'html' || code.trim().toLowerCase().startsWith('<!doctype') || code.trim().toLowerCase().startsWith('<html')) {
      return code;
    }

    // Wrap JS/CSS in a minimal HTML document
    if (language === 'javascript' || language === 'js' || language === 'typescript' || language === 'ts') {
      return `<!DOCTYPE html>
<html><head><style>body{font-family:system-ui;margin:1rem;color:#1a1a1a;}</style></head>
<body><div id="output"></div>
<script>
try {
  const _log = [];
  const _orig = { log: console.log, error: console.error, warn: console.warn };
  ['log','error','warn'].forEach(m => {
    console[m] = (...args) => {
      _log.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      _orig[m](...args);
      document.getElementById('output').innerHTML = '<pre style="font-size:13px;background:#f8f9fa;padding:8px;border-radius:4px;white-space:pre-wrap;margin-top:8px;">' + _log.join('\\n') + '</pre>';
    };
  });
  ${code}
  if (_log.length === 0) document.getElementById('output').innerHTML = '<em style="color:#9ca3af;font-size:13px;">Script executed (no output)</em>';
} catch(e) {
  document.getElementById('output').innerHTML = '<pre style="color:#ef4444;font-size:13px;">' + e.message + '</pre>';
}
</script></body></html>`;
    }

    if (language === 'css') {
      return `<!DOCTYPE html>
<html><head><style>body{font-family:system-ui;padding:1rem;}.preview-box{padding:1rem;border:1px solid #e5e7eb;border-radius:8px;}${code}</style></head>
<body><div class="preview-box"><h3>CSS Preview</h3><p>Styled content example.</p><button>Button</button><a href="#">Link</a></div></body></html>`;
    }

    // Default: show as plain text
    return null;
  }, [code, language]);

  if (!iframeSrc) return null;

  return (
    <div className={`rounded-lg overflow-hidden border border-[#383838] my-3 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-[#383838]">
        <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
          Live Preview
        </span>
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showCode ? 'Preview' : 'Code'}
        </button>
      </div>

      {/* Content */}
      {showCode ? (
        <pre className="px-4 py-3 text-xs font-mono text-gray-300 bg-[#1a1a1a] overflow-x-auto max-h-64 overflow-y-auto">
          <code>{code}</code>
        </pre>
      ) : (
        <iframe
          srcDoc={iframeSrc}
          sandbox="allow-scripts"
          className="w-full bg-[#2a2a2a]"
          style={{ height: '200px', border: 'none' }}
          title="Code preview"
        />
      )}
    </div>
  );
}
