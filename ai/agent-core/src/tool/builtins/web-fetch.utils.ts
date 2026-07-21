export function validateWebFetchFormat(value: unknown): string | null {
  if (value === undefined || value === 'text' || value === 'markdown') {
    return null;
  }
  return 'Error: "format" must be "text" or "markdown".';
}

export function webFetchRequestMetadata(
  url: string,
  format?: string,
): { url: string; format: 'text' | 'markdown' } {
  return { url, format: format === 'markdown' ? 'markdown' : 'text' };
}

export function validateWebFetchUrl(value: string): string | null {
  return normalizeWebFetchUrl(value).error;
}

export function normalizeWebFetchUrl(value: string): { url: string | null; error: string | null } {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { url: null, error: 'Error: "url" must use http:// or https://.' };
    }
    return { url: url.href, error: null };
  } catch {
    return { url: null, error: 'Error: "url" must be a valid http:// or https:// URL.' };
  }
}

export function formatWebFetchOutput(
  output: string,
  normalizedContentType: string,
  format?: string,
): string {
  if (format !== 'markdown' || !normalizedContentType.includes('html')) {
    return output;
  }
  return htmlToMarkdown(output);
}

export function isTextualWebFetchContentType(normalizedContentType: string): boolean {
  return (
    !normalizedContentType
    || normalizedContentType.includes('text/')
    || normalizedContentType.includes('json')
    || normalizedContentType.includes('xml')
    || normalizedContentType.includes('javascript')
    || normalizedContentType.includes('ecmascript')
  );
}

function htmlToMarkdown(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, text) => {
        return `\n${'#'.repeat(Number(level))} ${inlineHtmlToMarkdown(text)}\n\n`;
      })
      .replace(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_match, _quote, href, text) => {
        return `[${stripHtmlTags(text).trim()}](${href})`;
      })
      .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, text) => `\n- ${inlineHtmlToMarkdown(text).trim()}`)
      .replace(/<\/(p|div|section|article|ul|ol)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function inlineHtmlToMarkdown(html: string): string {
  return decodeHtmlEntities(stripHtmlTags(
    html.replace(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_match, _quote, href, text) => {
      return `[${stripHtmlTags(text).trim()}](${href})`;
    }),
  )).replace(/\s+/g, ' ').trim();
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}
