import { unquoteShellToken } from './shell-command.utils';

export function decodePrintfPercentBToken(token: string): string {
  const text = unquoteShellToken(token);
  let output = '';

  for (let index = 0; index < text.length; index += 1) {
    const escaped = readPrintfPercentBEscape(text, index);
    if (escaped) {
      output += escaped.value;
      index = escaped.endIndex;
      continue;
    }

    output += text[index];
  }

  return output;
}

function readPrintfPercentBEscape(text: string, index: number): { value: string; endIndex: number } | null {
  if (text[index] !== '\\') return null;

  if (text[index + 1] === '0') {
    const octal = text.slice(index + 2).match(/^[0-7]{1,3}/)?.[0];
    if (!octal) return null;
    return {
      value: String.fromCharCode(Number.parseInt(octal, 8)),
      endIndex: index + 1 + octal.length,
    };
  }

  if (text[index + 1] === 'x') {
    const hex = text.slice(index + 2).match(/^[0-9a-fA-F]{1,2}/)?.[0];
    if (!hex) return null;
    return {
      value: String.fromCharCode(Number.parseInt(hex, 16)),
      endIndex: index + 1 + hex.length,
    };
  }

  if (text[index + 1] === 'n') return { value: '\n', endIndex: index + 1 };
  if (text[index + 1] === '\\') return { value: '\\', endIndex: index + 1 };

  return null;
}
