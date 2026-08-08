const EXPLICIT_FIELD =
  /(^|[\r\n{[,;])([ \t]*)(["']?)(proxy-authorization|authorization|set-cookie|cookie)\3([ \t]*)([:=])([ \t]*)/gim;
const NEXT_HEADER =
  /^[ \t]*(?:"[^"\r\n]+"|'[^'\r\n]+'|[A-Za-z][A-Za-z0-9-]*)[ \t]*:/;
const CLOSE_DELIMITERS = new Set(["}", "]", ")"]);

export function cdpHeaderValueSpans(value) {
  if (typeof value !== "string" || value.length === 0) return [];
  const spans = [];
  for (const match of value.matchAll(EXPLICIT_FIELD)) {
    const start = match.index + match[0].length;
    if (start >= value.length) continue;
    const lineHeader =
      match[3] === "" &&
      match[6] === ":" &&
      (match[1] === "" || match[1] === "\r" || match[1] === "\n");
    const end = valueEnd(value, start, lineHeader);
    if (end > start) spans.push(Object.freeze({ start, end }));
  }
  return Object.freeze(spans);
}

export function redactCdpValueSpans(value, spans) {
  if (typeof value !== "string" || !Array.isArray(spans)) return value;
  const normalized = mergeSpans(value.length, spans);
  let output = value;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const { start, end } = normalized[index];
    output = `${output.slice(0, start)}[REDACTED]${output.slice(end)}`;
  }
  return output;
}

function valueEnd(value, start, lineHeader) {
  if (value.startsWith("[REDACTED]", start)) {
    return start + "[REDACTED]".length;
  }
  if (value[start] === '"' || value[start] === "'") {
    return quotedEnd(value, start);
  }
  if (lineHeader) return lineEnd(value, start);
  let quote = null;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = quote === character ? null : quote || character;
      continue;
    }
    if (quote) continue;
    if (character === "\r" || character === "\n") return index;
    if (CLOSE_DELIMITERS.has(character)) return index;
    if (
      (character === ";" || character === ",") &&
      NEXT_HEADER.test(value.slice(index + 1))
    ) {
      return index;
    }
  }
  return value.length;
}

function quotedEnd(value, start) {
  const quote = value[start];
  let escaped = false;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === quote) {
      return index + 1;
    } else if (character === "\r" || character === "\n") {
      return index;
    }
  }
  return value.length;
}

function lineEnd(value, start) {
  const carriage = value.indexOf("\r", start);
  const newline = value.indexOf("\n", start);
  const ends = [carriage, newline].filter((index) => index >= 0);
  return ends.length > 0 ? Math.min(...ends) : value.length;
}

function mergeSpans(length, spans) {
  const ordered = spans
    .map(({ start, end }) => ({ start, end }))
    .filter(
      ({ start, end }) =>
        Number.isInteger(start) && start >= 0 && end > start && end <= length,
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const span of ordered) {
    const previous = merged.at(-1);
    if (previous && span.start <= previous.end) {
      previous.end = Math.max(previous.end, span.end);
    } else {
      merged.push(span);
    }
  }
  return merged;
}
