import { literalCommandOutputToken } from './literal-command-output.utils';
import { normalizeShellWordToken } from './shell-command.utils';

const FILES0_FROM_OPTION = '-files0-from';

export function findFiles0FromTargets(tokens: string[]): string[] | null {
  let targets: string[] | null = null;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = normalizeShellWordToken(tokens[index]);
    const inlineSource = inlineFiles0FromSource(token);
    if (inlineSource !== null) {
      targets = staticFiles0FromTargets(inlineSource) ?? [];
      continue;
    }
    if (token !== FILES0_FROM_OPTION) continue;

    const source = readFiles0FromSource(tokens, index + 1);
    if (!source) {
      targets = [];
      continue;
    }
    targets = staticFiles0FromTargets(source.token) ?? [];
    index = source.endIndex;
  }

  return targets;
}

function inlineFiles0FromSource(token: string): string | null {
  return token.startsWith(`${FILES0_FROM_OPTION}=`)
    ? token.slice(`${FILES0_FROM_OPTION}=`.length)
    : null;
}

function readFiles0FromSource(tokens: string[], index: number): { token: string; endIndex: number } | null {
  const first = tokens[index];
  if (!first) return null;
  if (!first.trim().startsWith('<(')) return { token: first, endIndex: index };

  let token = first;
  let endIndex = index;
  while (endIndex + 1 < tokens.length && hasUnclosedProcessSubstitution(token)) {
    endIndex += 1;
    token += ` ${tokens[endIndex]}`;
  }
  return { token, endIndex };
}

function staticFiles0FromTargets(source: string): string[] | null {
  const command = processSubstitutionCommand(source);
  if (!command) return null;

  const output = literalCommandOutputToken(command);
  return output ? output.split('\0').filter(Boolean) : [];
}

function processSubstitutionCommand(source: string): string {
  const trimmed = source.trim();
  return trimmed.startsWith('<(') && trimmed.endsWith(')') ? trimmed.slice(2, -1) : '';
}

function hasUnclosedProcessSubstitution(token: string): boolean {
  return processSubstitutionCommand(token) === '';
}
