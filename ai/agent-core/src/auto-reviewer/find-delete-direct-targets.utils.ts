import { findFiles0FromTargets } from './find-delete-files0-from-targets.utils';
import { findStartPathTokens } from './find-exec-command.utils';
import { getShellTokenBasename, normalizeShellWordToken } from './shell-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { targetWithWorkingDir } from './rm-working-dir.utils';

export function directFindDeleteTargets(
  tokens: string[],
  workingDir: string,
  previousWorkingDir: string,
): string[] {
  const commandTokens = shellExecutableCommandTokens(splitUnquotedIfsExpansionTokens(tokens));
  if (getShellTokenBasename(commandTokens[0] ?? '') !== 'find') return [];
  if (!commandTokens.some((token) => normalizeShellWordToken(token) === '-delete')) return [];

  const files0Targets = findFiles0FromTargets(commandTokens);
  const targets = files0Targets ?? findStartPathTokens(commandTokens);
  return targets.map((target) => targetWithWorkingDir(target, workingDir, previousWorkingDir));
}
