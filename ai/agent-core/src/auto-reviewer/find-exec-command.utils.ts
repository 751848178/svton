import { normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';

const FIND_EXEC_PREDICATES = new Set(['-exec', '-execdir']);
const FIND_EXEC_TERMINATORS = new Set([';', '+']);
const FIND_OPTIONS_WITHOUT_PATH = new Set(['-H', '-L', '-P', '-E', '-X', '-d', '-s', '-x']);
const FIND_OPTIONS_WITH_PATH = new Set(['-f']);
const FIND_OPTIONS_WITH_ARGUMENT = new Set(['-D']);

export function findExecCommandTokenGroups(tokens: string[]): string[][] {
  const groups: string[][] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    if (!FIND_EXEC_PREDICATES.has(normalizeShellWordToken(tokens[index]))) continue;

    const commandTokens: string[] = [];
    let cursor = index + 1;
    for (; cursor < tokens.length; cursor += 1) {
      if (FIND_EXEC_TERMINATORS.has(normalizeShellWordToken(tokens[cursor]))) break;
      commandTokens.push(tokens[cursor]);
    }

    if (commandTokens.length > 0) groups.push(commandTokens);
    index = cursor;
  }

  return groups;
}

export function findStartPathTokens(tokens: string[]): string[] {
  const paths: string[] = [];
  let parsingOptions = true;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = normalizeShellWordToken(tokens[index]);
    if (parsingOptions && token === '--') {
      parsingOptions = false;
      continue;
    }
    if (parsingOptions && isFindOptionWithoutPath(token)) continue;
    if (parsingOptions && FIND_OPTIONS_WITH_ARGUMENT.has(token)) {
      index += 1;
      continue;
    }
    if (parsingOptions && FIND_OPTIONS_WITH_PATH.has(token)) {
      if (tokens[index + 1]) paths.push(tokens[index + 1]);
      index += 1;
      continue;
    }

    parsingOptions = false;
    if (isFindExpressionToken(token)) break;
    paths.push(tokens[index]);
  }

  return paths.length > 0 ? paths : ['.'];
}

export function expandFindExecPlaceholderTokens(tokens: string[], replacements: string[]): string[] {
  return tokens.flatMap((token) => {
    const shellWord = unquoteShellToken(token);
    if (!shellWord.includes('{}')) return [token];
    return replacements.map((replacement) => shellWord.split('{}').join(replacement));
  });
}

function isFindOptionWithoutPath(token: string): boolean {
  return FIND_OPTIONS_WITHOUT_PATH.has(token) || /^-O\d*$/.test(token);
}

function isFindExpressionToken(token: string): boolean {
  return token.startsWith('-') || token === '(' || token === '!' || token === ')';
}
