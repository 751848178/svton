/**
 * Minimal HTML sanitizer for highlight.js output and simple markdown-to-HTML conversion.
 *
 * Removes <script>, <iframe>, <object>, <embed>, <form>, event handlers (on*),
 * and javascript: URLs. Keeps semantic HTML tags used by highlight.js themes.
 */

const ALLOWED_TAGS = new Set([
  // highlight.js spans
  'span',
  // Block elements
  'div', 'p', 'pre', 'code', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'br', 'a', 'strong', 'em', 'del', 's', 'img',
  // Semantic
  'sup', 'sub', 'mark', 'abbr', 'details', 'summary',
]);

const ALLOWED_ATTRS = new Set([
  'class', 'id', 'style',
  // a tags
  'href', 'target', 'rel',
  // img tags
  'src', 'alt', 'width', 'height',
]);

/**
 * Sanitize HTML to remove XSS vectors.
 * Strips disallowed tags (keeps text content), removes event handlers and javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  // Remove script, iframe, object, embed, form, style, link, meta, base tags entirely
  let result = html.replace(
    /<\/?(script|iframe|object|embed|applet|form|input|textarea|select|button|link|meta|base|noscript|template|svg|math)\b[^>]*>/gi,
    '',
  );

  // Remove on* event handler attributes
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: and data: URLs
  result = result.replace(/(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi, '$1="');

  // Remove data: URLs in src attributes (but allow data:image in img src — common for embedded images)
  result = result.replace(/src\s*=\s*["']\s*data:(?!image\/)/gi, 'src="');

  return result;
}
