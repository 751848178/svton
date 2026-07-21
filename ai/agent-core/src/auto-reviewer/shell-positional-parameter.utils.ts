import type { ShellCommandStringInvocation } from './shell-c-command.utils';
import { normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';

export interface ShellPositionalArguments {
  argv0: string;
  positionalArgs: string[];
}

export function shellCommandStringPositionals(
  invocation: ShellCommandStringInvocation,
  parent?: ShellPositionalArguments,
): ShellPositionalArguments {
  return {
    argv0: firstShellPositionalTargetToken(invocation.argv0, parent),
    positionalArgs: invocation.positionalArgs
      .flatMap((token) => shellPositionalTargetTokens(token, parent)),
  };
}

export function shellPositionalTargetTokens(
  target: string,
  positionals?: ShellPositionalArguments,
): string[] {
  if (!positionals) return [target];

  const token = normalizeShellWordToken(unquoteShellToken(target));
  const spreadTargets = shellSpreadTargetTokens(token, positionals);
  if (spreadTargets) return spreadTargets;

  const defaultTargets = shellDefaultTargetTokens(token, positionals);
  if (defaultTargets) return defaultTargets;

  const indexedTargets = shellIndexedTargetTokens(token, positionals);
  return indexedTargets ?? [target];
}

function firstShellPositionalTargetToken(
  target: string,
  positionals?: ShellPositionalArguments,
): string {
  if (!target) return '';
  return shellPositionalTargetTokens(target, positionals)[0] ?? '';
}

function shellSpreadTargetTokens(
  token: string,
  positionals: ShellPositionalArguments,
): string[] | null {
  const match = token.match(/^(.*)(\$(?:[@*]|\{[@*]\}))(.*)$/);
  if (!match) return null;

  const [, prefix, marker, suffix] = match;
  if (marker.includes('*')) {
    const joined = positionals.positionalArgs.map(normalizePositionalValue).join(' ');
    return joined ? [`${prefix}${joined}${suffix}`] : [];
  }

  return positionals.positionalArgs
    .map((value) => `${prefix}${normalizePositionalValue(value)}${suffix}`);
}

function shellIndexedTargetTokens(
  token: string,
  positionals: ShellPositionalArguments,
): string[] | null {
  const match = token.match(/^\$(\d+)(.*)$/) ?? token.match(/^\$\{(\d+)\}(.*)$/);
  if (!match) return null;

  const index = Number(match[1]);
  const value = index === 0 ? positionals.argv0 : positionals.positionalArgs[index - 1];
  return value ? [`${normalizePositionalValue(value)}${match[2]}`] : [];
}

function shellDefaultTargetTokens(
  token: string,
  positionals: ShellPositionalArguments,
): string[] | null {
  const match = token.match(/^\$\{(\d+)(:?[-+])([^}]*)\}(.*)$/);
  if (!match) return null;

  const [, indexText, operator, fallback, suffix] = match;
  const value = positionalValue(Number(indexText), positionals);
  const valueIsSet = value !== undefined && (!operator.startsWith(':') || value !== '');
  const useFallback = operator.includes('-') ? !valueIsSet : valueIsSet;
  const selected = useFallback ? fallback : value;
  if (!selected) return [];

  return shellPositionalTargetTokens(selected, positionals)
    .map((target) => `${normalizePositionalValue(target)}${suffix}`);
}

function positionalValue(index: number, positionals: ShellPositionalArguments): string | undefined {
  return index === 0 ? positionals.argv0 : positionals.positionalArgs[index - 1];
}

function normalizePositionalValue(value: string): string {
  return normalizeShellWordToken(unquoteShellToken(value));
}
