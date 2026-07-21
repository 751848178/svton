import {
  getShellTokenBasename,
  splitShellWords,
  unquoteShellToken,
} from './shell-command.utils';
import { embeddedCommandSubstitutionOutputToken } from './command-substitution-embedded-token.utils';

export function mergeWholeCommandSubstitutionTokens(tokens: string[]): string[] {
  const merged: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!startsUnclosedCommandSubstitution(token)) {
      merged.push(token);
      continue;
    }

    let combined = token;
    while (index + 1 < tokens.length && !endsCommandSubstitution(combined)) {
      index += 1;
      combined += ` ${tokens[index]}`;
    }
    merged.push(combined);
  }

  return merged;
}

function startsUnclosedCommandSubstitution(token: string): boolean {
  return hasUnclosedCommandSubstitution(token);
}

function endsCommandSubstitution(token: string): boolean {
  return !hasUnclosedCommandSubstitution(token);
}

function hasUnclosedCommandSubstitution(token: string): boolean {
  let quote: '"' | "'" | null = null;
  let commandSubstitutionDepth = 0;
  let backtickOpen = false;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (quote) {
      if (char === quote) quote = null;
      if (quote === '"' && char === '\\' && token[index + 1]) index += 1;
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

    if (char === '`') {
      backtickOpen = !backtickOpen;
      continue;
    }

    if (char === '$' && token[index + 1] === '(') {
      commandSubstitutionDepth += 1;
      index += 1;
      continue;
    }

    if (char === ')' && commandSubstitutionDepth > 0) commandSubstitutionDepth -= 1;
  }

  return commandSubstitutionDepth > 0 || backtickOpen;
}

export function commandSubstitutionTokenResolvesToCommand(
  token: string,
  commands: Set<string>,
): boolean {
  const outputToken = commandSubstitutionOutputToken(token);
  const [commandToken] = splitShellWords(outputToken);
  return commandToken ? commands.has(getShellTokenBasename(commandToken)) : false;
}

export function commandSubstitutionOutputToken(token: string): string {
  return commandSubstitutionOutputTokenResult(token)?.token ?? '';
}

export function commandSubstitutionOutputTokenResult(token: string): { token: string } | null {
  const outputToken = embeddedCommandSubstitutionOutputToken(token);
  return outputToken === null ? null : { token: outputToken };
}

export function expandLeadingCommandSubstitutionTokens(tokens: string[]): string[] {
  const outputToken = commandSubstitutionOutputToken(tokens[0] ?? '');
  if (!outputToken) return tokens;

  const outputTokens = splitShellWords(outputToken);
  return outputTokens.length > 0 ? [...outputTokens, ...tokens.slice(1)] : tokens;
}
