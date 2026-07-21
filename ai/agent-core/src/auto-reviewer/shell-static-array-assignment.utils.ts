import { mergeWholeCommandSubstitutionTokens } from './command-substitution-token.utils';
import { splitShellWords } from './shell-command.utils';
import type { StaticShellAssignment } from './shell-static-assignment.types';
import { staticShellWordValue } from './shell-static-variable-command.utils';

export function mergeStaticArrayAssignmentTokens(tokens: string[]): string[] {
  const merged: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    let token = tokens[index];
    if (!startsUnclosedArrayAssignment(token)) {
      merged.push(token);
      continue;
    }

    while (index + 1 < tokens.length && hasUnclosedArrayAssignment(token)) {
      index += 1;
      token += ` ${tokens[index]}`;
    }
    merged.push(token);
  }

  return merged;
}

export function staticArrayAssignmentToken(
  token: string,
  readonly: boolean,
  exported?: boolean,
  blocksAllexport = false,
): StaticShellAssignment | null {
  const indexed = token.match(/^([A-Za-z_]\w*)\[(\d+)\]=([\s\S]*)$/);
  if (indexed) {
    return indexed[2] === '0'
      ? shellAssignment(indexed[1], indexed[3], readonly, exported, blocksAllexport)
      : null;
  }

  const compound = token.match(/^([A-Za-z_]\w*)=\(([\s\S]*)\)$/);
  if (!compound) return null;

  return shellAssignment(compound[1], firstArrayElementValue(compound[2]), readonly, exported, blocksAllexport);
}

function shellAssignment(
  name: string,
  valueToken: string,
  readonly: boolean,
  exported: boolean | undefined,
  blocksAllexport: boolean,
): StaticShellAssignment {
  return {
    name,
    readonly,
    exported,
    blocksAllexport,
    value: staticShellWordValue(valueToken),
  };
}

function firstArrayElementValue(arrayBody: string): string {
  const tokens = mergeWholeCommandSubstitutionTokens(splitShellWords(arrayBody));
  let nextIndex = 0;
  let firstValue = '';
  let hasFirstValue = false;

  for (const token of tokens) {
    const keyed = token.match(/^\[(\d+)\]=([\s\S]*)$/);
    if (keyed) {
      const index = Number.parseInt(keyed[1], 10);
      if (index === 0) {
        firstValue = keyed[2];
        hasFirstValue = true;
      }
      nextIndex = index + 1;
      continue;
    }

    if (nextIndex === 0) {
      firstValue = token;
      hasFirstValue = true;
    }
    nextIndex += 1;
  }

  return hasFirstValue ? firstValue : '';
}

function startsUnclosedArrayAssignment(token: string): boolean {
  return /^[A-Za-z_]\w*=\(/.test(token) && hasUnclosedArrayAssignment(token);
}

function hasUnclosedArrayAssignment(token: string): boolean {
  const start = token.indexOf('=(');
  if (start === -1) return false;

  let quote: '"' | "'" | null = null;
  let depth = 0;

  for (let index = start + 1; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      if (char === quote) quote = null;
      if (char === '\\' && token[index + 1]) index += 1;
      continue;
    }

    if (char === '\\') {
      if (token[index + 1]) index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
  }

  return depth > 0;
}
