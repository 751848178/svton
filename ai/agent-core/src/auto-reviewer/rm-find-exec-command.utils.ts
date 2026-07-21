import {
  expandFindExecPlaceholderTokens,
  findExecCommandTokenGroups,
  findStartPathTokens,
} from './find-exec-command.utils';
import { findFiles0FromTargets } from './find-delete-files0-from-targets.utils';
import { dangerousRmInvocations } from './rm-invocation.utils';
import { targetWithWorkingDir } from './rm-working-dir.utils';
import { getShellTokenBasename } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import {
  type ShellPositionalArguments,
  shellPositionalTargetTokens,
} from './shell-positional-parameter.utils';

type ShellTokensDangerousTargets = (
  tokens: string[],
  depth: number,
  positionals?: ShellPositionalArguments,
  workingDir?: string,
) => string[];

export function getFindExecDangerousRecursiveForceTargets(
  tokens: string[],
  depth: number,
  positionals: ShellPositionalArguments | undefined,
  workingDir: string,
  shellTokensDangerousTargets: ShellTokensDangerousTargets,
): string[] {
  const commandTokens = splitUnquotedIfsExpansionTokens(tokens);
  if (getShellTokenBasename(commandTokens[0] ?? '') !== 'find') return [];

  const startPathTokens = findFiles0FromTargets(commandTokens) ?? findStartPathTokens(commandTokens);
  const startPaths = startPathTokens
    .flatMap((target) => shellPositionalTargetTokens(target, positionals));
  return findExecCommandTokenGroups(commandTokens)
    .flatMap((commandTokens) => {
      const expandedTokens = expandFindExecPlaceholderTokens(commandTokens, startPaths);
      return [
        ...dangerousRmInvocations(expandedTokens)
          .flatMap((invocation) => invocation.targets)
          .map((target) => targetWithWorkingDir(target, workingDir)),
        ...shellTokensDangerousTargets(expandedTokens, depth, positionals, workingDir),
      ];
    });
}
