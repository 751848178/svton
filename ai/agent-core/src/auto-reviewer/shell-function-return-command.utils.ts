import { getShellTokenBasename, normalizeShellWordToken, splitShellWords } from './shell-command.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import type { StaticShellCommandStatus } from './shell-static-command-status.types';

export interface ShellFunctionReturnCommand {
  status: StaticShellCommandStatus;
}

export function staticFunctionReturnCommand(
  statement: string,
  previousStatus: StaticShellCommandStatus,
): ShellFunctionReturnCommand | null {
  if (splitShellPipelineSegments(statement).length > 1) return null;

  const tokens = splitShellWords(statement).map(normalizeShellWordToken);
  const returnIndex = firstNonNegationTokenIndex(tokens);
  if (getShellTokenBasename(tokens[returnIndex] ?? '') !== 'return') return null;

  const args = returnArgumentTokens(tokens.slice(returnIndex + 1));
  if (args.length === 0) return { status: previousStatus ?? true };
  if (args.length !== 1 || !/^\d+$/.test(args[0])) return { status: null };
  return { status: Number(args[0]) === 0 };
}

function firstNonNegationTokenIndex(tokens: string[]): number {
  let index = 0;
  while (tokens[index] === '!') index += 1;
  return index;
}

function returnArgumentTokens(tokens: string[]): string[] {
  const args: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const redirection = readShellRedirectionToken(tokens[index]);
    if (redirection) {
      if (!redirection.hasOperand) index += 1;
      continue;
    }
    args.push(tokens[index]);
  }

  return args;
}

function readShellRedirectionToken(token: string): { hasOperand: boolean } | null {
  const match = token.match(/^(?:\d+)?(?:<<-?|<<<|<>|>>?|>&|<&|&>|&>>)(.*)$/);
  return match ? { hasOperand: match[1] !== '' } : null;
}
