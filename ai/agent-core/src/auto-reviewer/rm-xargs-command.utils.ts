import { pipedXargsCommandTokenVariants } from './piped-xargs-command.utils';
import { dangerousRmInvocations } from './rm-invocation.utils';
import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import type { ShellPositionalArguments } from './shell-positional-parameter.utils';

type SplitCommandTokens = (command: string) => string[];
type TokensStartWithShell = (tokens: string[]) => boolean;
type ShellTokensDangerousTargets = (
  tokens: string[],
  depth: number,
  positionals?: ShellPositionalArguments,
  workingDir?: string,
) => string[];

export function getPipedXargsDangerousRecursiveForceTargets(
  command: string,
  splitCommandTokens: SplitCommandTokens,
  shellTokensDangerousTargets: ShellTokensDangerousTargets,
  tokensStartWithShell: TokensStartWithShell,
  depth: number,
  positionals?: ShellPositionalArguments,
  workingDir = '',
): string[] {
  return pipedXargsCommandTokenVariants(command, splitCommandTokens)
    .flatMap((commandTokens) => [
      ...dangerousRmInvocations(commandTokens).flatMap((invocation) => invocation.targets),
      ...xargsShellTokensDangerousTargets(
        commandTokens,
        tokensStartWithShell,
        shellTokensDangerousTargets,
        depth,
        positionals,
        workingDir,
      ),
    ]);
}

export function getShellCommandPipedXargsDangerousRecursiveForceTargets(
  command: string,
  splitCommandTokens: SplitCommandTokens,
  shellTokensDangerousTargets: ShellTokensDangerousTargets,
  tokensStartWithShell: TokensStartWithShell,
  depth: number,
  positionals?: ShellPositionalArguments,
  workingDir = '',
): string[] {
  return getPipedXargsDangerousRecursiveForceTargets(
    command,
    splitCommandTokens,
    shellTokensDangerousTargets,
    tokensStartWithShell,
    depth,
    positionals,
    workingDir,
  );
}

function xargsShellTokensDangerousTargets(
  commandTokens: string[],
  tokensStartWithShell: TokensStartWithShell,
  shellTokensDangerousTargets: ShellTokensDangerousTargets,
  depth: number,
  positionals?: ShellPositionalArguments,
  workingDir = '',
): string[] {
  const { commandTokens: executableTokens } = splitShellAssignmentPrefixes(commandTokens);
  const shellWords = splitUnquotedIfsExpansionTokens(executableTokens);
  return tokensStartWithShell(shellWords)
    ? shellTokensDangerousTargets(commandTokens, depth, positionals, workingDir)
    : [];
}
