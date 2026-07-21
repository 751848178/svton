import {
  isStaticPrintfConversion,
  readStaticPrintfDirective,
  renderStaticPrintfConversion,
  type StaticPrintfConversion,
} from './shell-static-printf-directive.utils';

type StaticPrintfPart = string | StaticPrintfConversion;

export function formatStaticPrintfValue(format: string, args: string[]): string | null {
  const parts = staticPrintfParts(format);
  if (!parts) return null;
  if (!parts.some(isStaticPrintfConversion)) return parts.join('');

  let output = '';
  let argIndex = 0;
  do {
    for (const part of parts) {
      if (!isStaticPrintfConversion(part)) {
        output += part;
        continue;
      }

      const rendered = renderStaticPrintfConversion(part, args, argIndex);
      if (!rendered) return null;
      output += rendered.value;
      argIndex = rendered.nextArgIndex;
    }
  } while (argIndex < args.length);

  return output;
}

function staticPrintfParts(format: string): StaticPrintfPart[] | null {
  const parts: StaticPrintfPart[] = [];
  for (let index = 0; index < format.length; index += 1) {
    const char = format[index];
    if (char !== '%') {
      const escaped = readStaticPrintfFormatEscape(format, index);
      if (escaped) {
        parts.push(escaped.value);
        index = escaped.endIndex;
        continue;
      }

      parts.push(char);
      continue;
    }

    const directive = readStaticPrintfDirective(format, index);
    if (!directive) return null;
    parts.push(directive.part);
    index = directive.endIndex;
  }

  return parts;
}

function readStaticPrintfFormatEscape(
  text: string,
  index: number,
): { value: string; endIndex: number } | null {
  if (text[index] !== '\\') return null;

  const octal = text.slice(index + 1).match(/^[0-7]{1,3}/)?.[0];
  if (octal) {
    return {
      value: String.fromCharCode(Number.parseInt(octal, 8)),
      endIndex: index + octal.length,
    };
  }

  const next = text[index + 1];
  if (next === 'x') {
    const hex = text.slice(index + 2).match(/^[0-9a-fA-F]{1,2}/)?.[0];
    if (!hex) return null;
    return {
      value: String.fromCharCode(Number.parseInt(hex, 16)),
      endIndex: index + 1 + hex.length,
    };
  }
  if (next === 'n') return { value: '\n', endIndex: index + 1 };
  if (next === '\\') return { value: '\\', endIndex: index + 1 };

  return null;
}
