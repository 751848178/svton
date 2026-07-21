import { normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';

interface EchoOutputOptions {
  enableEscapes: boolean;
  firstOutputIndex: number;
}

export function echoOutputToken(tokens: string[]): string {
  const options = echoOutputOptions(tokens);
  const output = tokens
    .slice(options.firstOutputIndex)
    .map(normalizeShellWordToken)
    .join(' ');
  return options.enableEscapes ? decodeEchoEscapes(output) : output;
}

function echoOutputOptions(tokens: string[]): EchoOutputOptions {
  let enableEscapes = false;
  let firstOutputIndex = 1;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = unquoteShellToken(tokens[index]);
    if (!/^-[neE]+$/.test(token)) break;

    firstOutputIndex = index + 1;
    for (const option of token.slice(1)) {
      if (option === 'e') enableEscapes = true;
      if (option === 'E') enableEscapes = false;
    }
  }

  return { enableEscapes, firstOutputIndex };
}

function decodeEchoEscapes(text: string): string {
  let output = '';

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\\') {
      output += text[index];
      continue;
    }

    const escaped = readEchoEscape(text, index);
    output += escaped.value;
    index = escaped.endIndex;
  }

  return output;
}

function readEchoEscape(text: string, slashIndex: number): { value: string; endIndex: number } {
  const next = text[slashIndex + 1];
  if (!next) return { value: '\\', endIndex: slashIndex };

  if (next === 'n') return { value: '\n', endIndex: slashIndex + 1 };
  if (next === '\\') return { value: '\\', endIndex: slashIndex + 1 };
  if (next === 'x') return readHexEchoEscape(text, slashIndex);
  if (next === '0') return readOctalEchoEscape(text, slashIndex);

  return { value: next, endIndex: slashIndex + 1 };
}

function readHexEchoEscape(text: string, slashIndex: number): { value: string; endIndex: number } {
  const digits = text.slice(slashIndex + 2).match(/^[0-9a-fA-F]{1,2}/)?.[0] ?? '';
  return digits
    ? { value: String.fromCharCode(Number.parseInt(digits, 16)), endIndex: slashIndex + 1 + digits.length }
    : { value: 'x', endIndex: slashIndex + 1 };
}

function readOctalEchoEscape(text: string, slashIndex: number): { value: string; endIndex: number } {
  const digits = text.slice(slashIndex + 2).match(/^[0-7]{0,3}/)?.[0] ?? '';
  return digits
    ? { value: String.fromCharCode(Number.parseInt(digits, 8)), endIndex: slashIndex + 1 + digits.length }
    : { value: '\0', endIndex: slashIndex + 1 };
}
