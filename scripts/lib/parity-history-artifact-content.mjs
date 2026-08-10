// Content validation for DOM and text browser artifacts.
//
// Responsibility: ensure a DOM artifact decodes as UTF-8 and carries a minimal
// HTML/DOM signal, and that a text artifact decodes as UTF-8 with a minimum
// share of printable characters. This stops NUL or padding buffers from
// satisfying a size-only check. The screenshot (PNG) structural check lives in
// its own module; this one owns only UTF-8/DOM/text content policy.
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const MIN_PRINTABLE_RATIO = 0.5;

export function hasValidArtifactContent(kind, buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (kind === "dom") return hasValidDomContent(buffer);
  if (kind === "text") return hasValidTextContent(buffer);
  return true;
}

// DOM artifacts must be valid UTF-8 and contain a minimal HTML/DOM signal
// (doctype, or an opening/closing tag) so a buffer of NULs or raw padding
// cannot satisfy a size-only check.
function hasValidDomContent(buffer) {
  const text = decodeUtf8(buffer);
  if (text === null) return false;
  return /<(!doctype|\/?[a-z][\w:-]*)/i.test(text);
}

// Text artifacts must be valid UTF-8 with a minimum share of printable
// characters. A long run of NULs or non-text padding drops below the ratio and
// is rejected.
function hasValidTextContent(buffer) {
  const text = decodeUtf8(buffer);
  if (text === null || text.length === 0) return false;
  let printable = 0;
  for (const character of text) {
    if (isPrintable(character.codePointAt(0))) printable += 1;
  }
  return printable / text.length >= MIN_PRINTABLE_RATIO;
}

function isPrintable(code) {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
  return code >= 0x20 && code !== 0x7f;
}

function decodeUtf8(buffer) {
  try {
    return UTF8_DECODER.decode(buffer);
  } catch {
    return null;
  }
}
