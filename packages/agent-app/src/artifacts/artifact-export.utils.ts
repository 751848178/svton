import type { ArtifactExportRequest, EditableArtifactTarget } from '@svton/agent-ui';

const CODE_FORMATS: Record<string, { extension: string; mimeType: string }> = {
  html: { extension: 'html', mimeType: 'text/html' },
  css: { extension: 'css', mimeType: 'text/css' },
  javascript: { extension: 'js', mimeType: 'text/javascript' },
  js: { extension: 'js', mimeType: 'text/javascript' },
  jsx: { extension: 'jsx', mimeType: 'text/javascript' },
  typescript: { extension: 'ts', mimeType: 'text/typescript' },
  ts: { extension: 'ts', mimeType: 'text/typescript' },
  tsx: { extension: 'tsx', mimeType: 'text/typescript' },
  json: { extension: 'json', mimeType: 'application/json' },
  python: { extension: 'py', mimeType: 'text/x-python' },
  py: { extension: 'py', mimeType: 'text/x-python' },
  markdown: { extension: 'md', mimeType: 'text/markdown' },
  md: { extension: 'md', mimeType: 'text/markdown' },
};

const DOCUMENT_FORMATS = {
  markdown: { extension: 'md', mimeType: 'text/markdown' },
  text: { extension: 'txt', mimeType: 'text/plain' },
  html: { extension: 'html', mimeType: 'text/html' },
} as const;

export function buildArtifactExportRequest(
  target: EditableArtifactTarget,
  content: string,
): ArtifactExportRequest {
  const format = target.kind === 'document'
    ? DOCUMENT_FORMATS[target.format]
    : CODE_FORMATS[target.language?.toLowerCase() ?? ''] ?? { extension: 'txt', mimeType: 'text/plain' };
  const base = sanitizeFilename(target.title, format.extension);
  return {
    targetId: target.id,
    filename: `${base}.${format.extension}`,
    mimeType: `${format.mimeType};charset=utf-8`,
    content,
  };
}

function sanitizeFilename(title: string, extension: string): string {
  const withoutExtension = title.toLowerCase().endsWith(`.${extension}`)
    ? title.slice(0, -(extension.length + 1))
    : title;
  const normalized = withoutExtension.normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[. -]+$/g, '')
    .replace(/^[. -]+/g, '')
    .slice(0, 80);
  return normalized || 'artifact';
}
