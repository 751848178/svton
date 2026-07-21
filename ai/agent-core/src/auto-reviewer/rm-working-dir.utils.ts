import { posix as pathPosix } from 'node:path';
import { embeddedCommandSubstitutionOutputToken } from './command-substitution-embedded-token.utils';
import { staticCommandSubstitutionOutputToken } from './command-substitution-command-output.utils';
import { commandSubstitutionOutputToken } from './command-substitution-token.utils';
import { getShellTokenBasename, normalizeShellWordToken, unquoteShellToken } from './shell-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';

export interface WorkingDirState {
  current: string;
  previous: string;
}

export function initialWorkingDirState(current: string, previous = ''): WorkingDirState {
  return { current, previous };
}

export function nextStaticWorkingDirState(tokens: string[], state: WorkingDirState): WorkingDirState {
  const next = nextStaticWorkingDir(tokens, state.current, state.previous);
  return next === state.current ? state : { current: next, previous: state.current };
}

function nextStaticWorkingDir(tokens: string[], workingDir: string, previousWorkingDir: string): string {
  const targetToken = staticWorkingDirTargetToken(tokens);
  if (!targetToken) return workingDir;

  const resolvedTarget = targetCommandSubstitutionOutputToken(targetToken, workingDir);
  const target = unquoteShellToken(resolvedTarget || targetToken);
  if (target === '-') return previousWorkingDir || workingDir;

  const cwdExpansion = currentWorkingDirExpansionTarget(target, workingDir);
  if (cwdExpansion) return pathPosix.resolve(cwdExpansion);
  const previousExpansion = previousWorkingDirExpansionTarget(target, previousWorkingDir);
  if (previousExpansion) return pathPosix.resolve(previousExpansion);
  const directoryVariable = directoryVariableTarget(target, workingDir, previousWorkingDir);
  if (directoryVariable) return pathPosix.resolve(directoryVariable);

  if (!target || target.startsWith('~') || target.startsWith('`')) {
    return workingDir;
  }
  if (!resolvedTarget && target.startsWith('$')) {
    return workingDir;
  }

  if (target.startsWith('/')) return pathPosix.resolve(target);
  return workingDir.startsWith('/') ? pathPosix.resolve(workingDir, target) : workingDir;
}

function staticWorkingDirTargetToken(tokens: string[]): string | undefined {
  const commandTokens = splitUnquotedIfsExpansionTokens(tokens);
  const command = getShellTokenBasename(commandTokens[0] ?? '');
  if (command === 'cd') return staticCdTargetToken(commandTokens);
  if (command === 'pushd') return staticPushdTargetToken(commandTokens);
  return undefined;
}

function staticCdTargetToken(tokens: string[]): string | undefined {
  let targetIndex = 1;
  for (; targetIndex < tokens.length; targetIndex += 1) {
    const token = unquoteShellToken(tokens[targetIndex]);
    if (token === '--') {
      targetIndex += 1;
      break;
    }
    if (/^-[LP]+$/.test(token)) continue;
    break;
  }

  return hasOnlyRedirectTokens(tokens, targetIndex + 1) ? tokens[targetIndex] : undefined;
}

function staticPushdTargetToken(tokens: string[]): string | undefined {
  let targetIndex = 1;
  if (unquoteShellToken(tokens[targetIndex] ?? '') === '--') targetIndex += 1;

  const target = unquoteShellToken(tokens[targetIndex] ?? '');
  if (!target || target === '-n' || target.startsWith('+') || target.startsWith('-')) {
    return undefined;
  }

  return hasOnlyRedirectTokens(tokens, targetIndex + 1) ? tokens[targetIndex] : undefined;
}

function hasOnlyRedirectTokens(tokens: string[], startIndex: number): boolean {
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (!/^[0-9]*[<>]/.test(unquoteShellToken(tokens[index]))) return false;
  }

  return true;
}

export function targetWithWorkingDir(target: string, workingDir: string, previousWorkingDir = ''): string {
  const resolvedTarget = targetCommandSubstitutionOutputToken(target, workingDir);
  const normalized = normalizeShellWordToken(resolvedTarget || target);
  const previousWorkingDirTarget = previousWorkingDirExpansionTarget(normalized, previousWorkingDir);
  if (previousWorkingDirTarget) return previousWorkingDirTarget;

  const currentWorkingDirTarget = currentWorkingDirExpansionTarget(normalized, workingDir);
  if (currentWorkingDirTarget) return currentWorkingDirTarget;
  const directoryVariable = directoryVariableTarget(normalized, workingDir, previousWorkingDir);
  if (directoryVariable) return directoryVariable;

  if (
    !workingDir.startsWith('/')
    || normalized.startsWith('/')
    || normalized.startsWith('$')
    || normalized.startsWith('~')
    || normalized.startsWith('`')
  ) {
    return resolvedTarget ? normalized : target;
  }

  return pathPosix.join(workingDir, normalized);
}

function targetCommandSubstitutionOutputToken(token: string, workingDir: string): string {
  return embeddedCommandSubstitutionOutputToken(
    token,
    (command) => staticCommandSubstitutionOutputToken(command, workingDir),
  ) ?? commandSubstitutionOutputToken(token);
}

function currentWorkingDirExpansionTarget(target: string, workingDir: string): string {
  if (!workingDir.startsWith('/')) return '';
  if (target === '~+') return workingDir;
  if (target.startsWith('~+/')) return pathPosix.join(workingDir, target.slice(3));
  return '';
}

function previousWorkingDirExpansionTarget(target: string, previousWorkingDir: string): string {
  if (!previousWorkingDir.startsWith('/')) return '';
  if (target === '~-') return previousWorkingDir;
  if (target.startsWith('~-/')) return pathPosix.join(previousWorkingDir, target.slice(3));
  return '';
}

function directoryVariableTarget(target: string, workingDir: string, previousWorkingDir: string): string {
  const pwdTarget = shellDirectoryVariableTarget(target, '$PWD', '${PWD}', workingDir);
  return pwdTarget || shellDirectoryVariableTarget(target, '$OLDPWD', '${OLDPWD}', previousWorkingDir);
}

function shellDirectoryVariableTarget(
  target: string,
  plainVariable: string,
  bracedVariable: string,
  directory: string,
): string {
  if (!directory.startsWith('/')) return '';
  const operatorTarget = shellDirectoryVariableOperatorTarget(target, bracedVariable, directory);
  if (operatorTarget) return operatorTarget;
  if (target === plainVariable || target === bracedVariable) return directory;
  if (target.startsWith(`${plainVariable}/`)) return pathPosix.join(directory, target.slice(plainVariable.length + 1));
  if (target.startsWith(`${bracedVariable}/`)) return pathPosix.join(directory, target.slice(bracedVariable.length + 1));
  return '';
}

function shellDirectoryVariableOperatorTarget(target: string, bracedVariable: string, directory: string): string {
  const name = bracedVariable.slice(2, -1);
  const match = target.match(new RegExp(`^\\$\\{${name}(?::?[-=?][^}]*)\\}(/.*)?$`));
  if (!match) return '';
  return match[1] ? pathPosix.join(directory, match[1].slice(1)) : directory;
}
