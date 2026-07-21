import { readPrintfDirective } from './printf-directive.utils';
import type { PrintfConversion, PrintfDirective, PrintfModifier } from './printf-directive.utils';
import { decodePrintfPercentBToken } from './printf-percent-b-token.utils';
import { normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';

export type PrintfOutputTokenResult = { token: string };
const PRINTF_NAMED_ESCAPES: Record<string, string> = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\' };

export function printfOutputToken(tokens: string[]): string {
  return printfOutputTokenResult(tokens)?.token ?? '';
}

export function printfOutputTokenResult(tokens: string[]): PrintfOutputTokenResult | null {
  const formatIndex = firstPrintfFormatIndex(tokens);
  const format = unquoteShellToken(tokens[formatIndex] ?? '');
  if (tokens[formatIndex] === undefined) return null;
  if (!format) return { token: '' };
  if (!format.includes('%')) {
    return { token: decodePrintfFormatText(stripTrailingPrintfNewline(tokens[formatIndex])) };
  }

  const rendered = renderPrintfOutput(format, tokens, formatIndex + 1);
  return rendered === null ? null : { token: rendered };
}

function firstPrintfFormatIndex(tokens: string[]): number {
  return unquoteShellToken(tokens[1] ?? '') === '--' ? 2 : 1;
}

function renderPrintfOutput(format: string, tokens: string[], firstArgumentIndex: number): string | null {
  const normalizedFormat = format.endsWith('\\n') ? format.slice(0, -2) : format;
  let output = '';
  let argumentIndex = firstArgumentIndex;
  let renderedCycle = false;

  do {
    const rendered = renderPrintfFormatCycle(normalizedFormat, tokens, argumentIndex);
    if (!rendered || !rendered.renderedDirective) return renderedCycle ? output : null;

    output += rendered.output;
    argumentIndex = rendered.nextArgumentIndex;
    renderedCycle = true;
  } while (argumentIndex < tokens.length);

  return renderedCycle ? output : null;
}

function renderPrintfFormatCycle(
  format: string,
  tokens: string[],
  argumentIndex: number,
): { output: string; nextArgumentIndex: number; renderedDirective: boolean } | null {
  let output = '';
  let nextArgumentIndex = argumentIndex;
  let renderedDirective = false;

  for (let index = 0; index < format.length; index += 1) {
    const char = format[index];
    if (char !== '%') {
      const escaped = readPrintfFormatEscape(format, index);
      if (escaped) {
        output += escaped.value;
        index = escaped.endIndex;
        continue;
      }

      output += char;
      continue;
    }

    const directive = readPrintfDirective(format, index);
    if (!directive) return null;

    const rendered = renderPrintfDirectiveValue(directive, tokens, nextArgumentIndex);
    if (!rendered) return null;

    output += rendered.value;
    nextArgumentIndex = rendered.nextArgumentIndex;
    renderedDirective = true;
    index = directive.endIndex;
  }

  return { output, nextArgumentIndex, renderedDirective };
}

function renderPrintfDirectiveValue(
  directive: PrintfDirective,
  tokens: string[],
  argumentIndex: number,
): { value: string; nextArgumentIndex: number } | null {
  let nextArgumentIndex = argumentIndex;
  const widthResult = resolvePrintfModifier(directive.width, tokens, nextArgumentIndex);
  if (!widthResult) return null;
  nextArgumentIndex = widthResult.nextArgumentIndex;

  const precisionResult = resolvePrintfModifier(directive.precision, tokens, nextArgumentIndex);
  if (!precisionResult) return null;
  nextArgumentIndex = precisionResult.nextArgumentIndex;

  const token = tokens[nextArgumentIndex];
  let value = token === undefined ? '' : renderPrintfDirectiveToken(directive.conversion, token);
  if (token !== undefined) nextArgumentIndex += 1;

  const precision = precisionResult.value;
  if (directive.precision !== undefined && directive.conversion !== 'c') {
    if (precision < 0) return null;
    value = value.slice(0, precision);
  }

  const width = widthResult.value;
  if (width !== undefined && Math.abs(width) > value.length) return null;

  return { value, nextArgumentIndex };
}

function resolvePrintfModifier(
  modifier: PrintfModifier | undefined,
  tokens: string[],
  argumentIndex: number,
): { value: number | undefined; nextArgumentIndex: number } | null {
  if (modifier === undefined) return { value: undefined, nextArgumentIndex: argumentIndex };
  if (modifier !== 'argument') return { value: modifier, nextArgumentIndex: argumentIndex };

  const token = tokens[argumentIndex];
  if (token === undefined) return null;

  const text = unquoteShellToken(token);
  if (!/^[+-]?\d+$/.test(text)) return null;

  return {
    value: Number.parseInt(text, 10),
    nextArgumentIndex: argumentIndex + 1,
  };
}

function renderPrintfDirectiveToken(conversion: PrintfConversion, token: string): string {
  if (conversion === 'b') return decodePrintfPercentBToken(token);
  if (conversion === 'c') return normalizeShellWordToken(token)[0] ?? '';
  return normalizeShellWordToken(token);
}

function decodePrintfFormatText(token: string): string {
  const text = normalizeShellWordToken(token);
  let output = '';

  for (let index = 0; index < text.length; index += 1) {
    const escaped = readPrintfFormatEscape(text, index);
    if (escaped) {
      output += escaped.value;
      index = escaped.endIndex;
      continue;
    }

    output += text[index];
  }

  return output;
}

function readPrintfFormatEscape(
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
  const namedEscape = next ? PRINTF_NAMED_ESCAPES[next] : undefined;
  if (namedEscape !== undefined) return { value: namedEscape, endIndex: index + 1 };

  return null;
}

function stripTrailingPrintfNewline(token: string): string {
  const unquoted = unquoteShellToken(token);
  if (!unquoted.endsWith('\\n')) return token;
  if (
    (token.startsWith('"') && token.endsWith('"'))
    || (token.startsWith("'") && token.endsWith("'"))
  ) {
    return `${token[0]}${token.slice(1, -3)}${token[0]}`;
  }
  return unquoted.slice(0, -2);
}
