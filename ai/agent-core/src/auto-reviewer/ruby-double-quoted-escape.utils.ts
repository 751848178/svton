type RubyEscapeRead = { value: string; endIndex: number };

export function readRubyDoubleQuotedEscape(
  source: string,
  startIndex: number,
): RubyEscapeRead | null {
  if (source[startIndex + 1] === '\r' && source[startIndex + 2] === '\n') {
    return { value: '', endIndex: startIndex + 3 };
  }
  if (source[startIndex + 1] === '\n') return { value: '', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 'n') return { value: '\n', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 't') return { value: '\t', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 'r') return { value: '\r', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 'f') return { value: '\f', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 'v') return { value: '\v', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 'a') return { value: '\x07', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 'e') return { value: '\x1b', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 's') return { value: ' ', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === 'b') return { value: '\b', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === '\\') return { value: '\\', endIndex: startIndex + 2 };
  if (source[startIndex + 1] === '"') return { value: '"', endIndex: startIndex + 2 };
  const control = readControlEscape(source, startIndex);
  if (control) return control;
  const meta = readMetaEscape(source, startIndex);
  if (meta) return meta;
  const octal = readOctalEscape(source, startIndex);
  if (octal) return octal;
  const unicode = readFixedUnicodeEscape(source, startIndex);
  if (unicode) return unicode;
  const bracedUnicode = readBracedUnicodeEscape(source, startIndex);
  if (bracedUnicode) return bracedUnicode;
  return readHexEscape(source, startIndex);
}

function readHexEscape(source: string, startIndex: number): RubyEscapeRead | null {
  if (source[startIndex + 1] !== 'x') return null;

  const first = source[startIndex + 2] ?? '';
  if (!/[\da-fA-F]/.test(first)) return null;

  const second = source[startIndex + 3] ?? '';
  const hex = /[\da-fA-F]/.test(second) ? `${first}${second}` : first;
  const value = Number.parseInt(hex, 16);
  return value <= 0x7f ? { value: String.fromCharCode(value), endIndex: startIndex + 2 + hex.length } : null;
}

function readControlEscape(source: string, startIndex: number): RubyEscapeRead | null {
  const prefix = source[startIndex + 1] ?? '';
  const controlIndex = prefix === 'c' ? startIndex + 2 : startIndex + 3;
  if (prefix !== 'c' && source.slice(startIndex + 1, startIndex + 3) !== 'C-') return null;

  const control = source[controlIndex] ?? '';
  if (control === '\\') {
    const meta = readMetaEscape(source, controlIndex);
    return meta ? { value: 'x', endIndex: meta.endIndex } : null;
  }
  if (control === '?') return { value: '\x7f', endIndex: controlIndex + 1 };
  if (!/[A-Za-z]/.test(control)) return null;
  const value = control.toUpperCase().charCodeAt(0) & 0x1f;
  return { value: String.fromCharCode(value), endIndex: controlIndex + 1 };
}

function readMetaEscape(source: string, startIndex: number): RubyEscapeRead | null {
  if (source.slice(startIndex + 1, startIndex + 3) !== 'M-') return null;

  if (source[startIndex + 3] === '\\') {
    const control = readControlEscape(source, startIndex + 3);
    return control ? { value: 'x', endIndex: control.endIndex } : null;
  }

  const operand = source[startIndex + 3] ?? '';
  if (!operand || operand === '\n' || operand === '\\' || operand === '"') return null;
  if (operand.charCodeAt(0) > 0x7f) return null;

  return { value: operand, endIndex: startIndex + 4 };
}

function readOctalEscape(source: string, startIndex: number): RubyEscapeRead | null {
  const first = source[startIndex + 1] ?? '';
  if (!/[0-7]/.test(first)) return null;

  let endIndex = startIndex + 2;
  while (endIndex < startIndex + 4 && /[0-7]/.test(source[endIndex] ?? '')) {
    endIndex += 1;
  }

  const value = Number.parseInt(source.slice(startIndex + 1, endIndex), 8);
  return value <= 0x7f ? { value: String.fromCharCode(value), endIndex } : null;
}

function readFixedUnicodeEscape(source: string, startIndex: number): RubyEscapeRead | null {
  if (source[startIndex + 1] !== 'u') return null;

  const hex = source.slice(startIndex + 2, startIndex + 6);
  if (!/^[\da-fA-F]{4}$/.test(hex)) return null;

  const value = Number.parseInt(hex, 16);
  return value <= 0x7f ? { value: String.fromCharCode(value), endIndex: startIndex + 6 } : null;
}

function readBracedUnicodeEscape(source: string, startIndex: number): RubyEscapeRead | null {
  if (source.slice(startIndex + 1, startIndex + 3) !== 'u{') return null;

  const closeIndex = source.indexOf('}', startIndex + 3);
  if (closeIndex < 0) return null;

  const hexValues = source.slice(startIndex + 3, closeIndex).trim().split(/[ \t\n\r\f\v]+/);
  if (hexValues.length === 0) return null;

  let value = '';
  for (const hex of hexValues) {
    if (!/^[\da-fA-F]{1,6}$/.test(hex)) return null;
    const codepoint = Number.parseInt(hex, 16);
    if (codepoint > 0x7f) return null;
    value += String.fromCharCode(codepoint);
  }

  return { value, endIndex: closeIndex + 1 };
}
