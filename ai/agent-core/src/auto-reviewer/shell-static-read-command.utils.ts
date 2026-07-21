import { normalizeShellWordToken } from './shell-command.utils';

type StaticReadVariableNameOptions = {
  allowNulDelimiter?: boolean;
  allowPrompt?: boolean;
};

const STATIC_READ_FLAG_OPTIONS = new Set(['e', 'r', 's']);

export function staticReadHereString(tokens: string[]): { index: number; word: string } | null {
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '<<<') {
      const word = tokens[index + 1];
      return word ? { index, word } : null;
    }
    if (token.startsWith('<<<') && token.length > 3) {
      return { index, word: token.slice(3) };
    }
  }

  return null;
}

export function staticReadVariableNames(
  tokens: string[],
  options: StaticReadVariableNameOptions = {},
): string[] | null {
  const names: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const word = normalizeShellWordToken(tokens[index]);
    if (word === '--') continue;
    if (word.startsWith('-')) {
      const optionEndIndex = staticReadOptionEndIndex(tokens, index, word, options);
      if (optionEndIndex === null) return null;
      index = optionEndIndex;
      continue;
    }
    if (!/^[A-Za-z_]\w*$/.test(word)) return null;
    names.push(word);
  }

  return names.length > 0 ? names : ['REPLY'];
}

export function staticReadValues(names: string[], value: string): [string, string][] {
  if (names.length === 1) return [[names[0], value]];

  const fields = value.trim().length > 0 ? value.trim().split(/\s+/) : [];
  return names.map((name, index) => [
    name,
    index === names.length - 1 ? fields.slice(index).join(' ') : fields[index] ?? '',
  ]);
}

function staticReadOptionEndIndex(
  tokens: string[],
  index: number,
  word: string,
  options: StaticReadVariableNameOptions,
): number | null {
  const readOptions = word.slice(1);
  if (readOptions.length === 0) return null;

  for (let optionIndex = 0; optionIndex < readOptions.length; optionIndex += 1) {
    const readOption = readOptions[optionIndex];
    if (STATIC_READ_FLAG_OPTIONS.has(readOption)) continue;
    if (readOption === 'd') return readDelimiterOptionEndIndex(tokens, index, optionIndex, readOptions, options);
    if (readOption === 'p') return readPromptOptionEndIndex(tokens, index, optionIndex, readOptions, options);
    return null;
  }

  return index;
}

function readDelimiterOptionEndIndex(
  tokens: string[],
  index: number,
  optionIndex: number,
  readOptions: string,
  options: StaticReadVariableNameOptions,
): number | null {
  if (!options.allowNulDelimiter || optionIndex !== readOptions.length - 1) return null;

  const delimiterToken = tokens[index + 1];
  if (delimiterToken === undefined) return null;

  return normalizeShellWordToken(delimiterToken) === '' ? index + 1 : null;
}

function readPromptOptionEndIndex(
  tokens: string[],
  index: number,
  optionIndex: number,
  readOptions: string,
  options: StaticReadVariableNameOptions,
): number | null {
  if (!options.allowPrompt || optionIndex !== readOptions.length - 1) return null;
  return tokens[index + 1] === undefined ? null : index + 1;
}
