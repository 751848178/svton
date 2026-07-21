import { getShellTokenBasename, splitShellSegments, splitShellWords, unquoteShellToken } from './shell-command.utils';
import { commandSubstitutionTokenResolvesToCommand, expandLeadingCommandSubstitutionTokens, mergeWholeCommandSubstitutionTokens } from './command-substitution-token.utils';
import { evalCommandString } from './eval-command-string.utils';
import { pipedShellScriptInputCommandStrings } from './piped-shell-script-input-command.utils';
import { nextStaticShellCommandWorkingDirState } from './rm-command-working-dir-state.utils';
import { hostedExecutableCommandTokenGroups, hostedShellCommandStrings } from './hosted-shell-command.utils';
import { dangerousRmInvocations } from './rm-invocation.utils';
import { getFindExecDangerousRecursiveForceTargets } from './rm-find-exec-command.utils';
import { markShellGlobStateTargets, tokenTargetsHome, tokenTargetsRoot } from './rm-target.utils';
import { initialWorkingDirState, targetWithWorkingDir } from './rm-working-dir.utils';
import { getShellCommandPipedXargsDangerousRecursiveForceTargets } from './rm-xargs-command.utils';
import { firstShellCommandStringInvocation } from './shell-c-command.utils';
import { shellCaseBranchCommandStrings } from './shell-case-command.utils';
import { SHELL_COMMANDS } from './shell-command-name.constants';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { withoutShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { stripShellControlCommandPrefix } from './shell-control-command.utils';
import { staticShellLoopCommandStrings } from './shell-for-loop-command.utils';
import { resolveShellFunctionCommand, shellFunctionInvocationPositionals, withShellFunctionInvocationPrefixAssignments } from './shell-function-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { shellCommandStringTokenGroups } from './shell-launcher-command.utils';
import { shellScriptInputCommandStrings, stripHereDocBodies } from './shell-script-input-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import { nextShellCommandGlobEnabled } from './shell-glob-state.utils';
import { preferredStaticAssignmentCommandResults, staticAssignmentCommandVariantResults } from './shell-static-assignment-variant.utils';
import { type ShellPositionalArguments, shellCommandStringPositionals, shellPositionalTargetTokens } from './shell-positional-parameter.utils';
import { type ShellTrapActionCommand, resolveShellTrapActionCommand, shellTrapActionCommand, shellTrapActionCommandFromStatement } from './shell-trap-action-command.utils';
const MAX_RM_COMMAND_STRING_DEPTH = 5;
function getDangerousRecursiveForceTargets(
  command: string,
  depth = 0,
  positionals?: ShellPositionalArguments,
  workingDir = '',
  previousWorkingDir = '',
  extglobEnabled = false,
  globEnabled = true,
): string[] {
  if (depth > MAX_RM_COMMAND_STRING_DEPTH) return [];
  const commandHeader = stripHereDocBodies(command);
  const staticTargets = preferredStaticAssignmentCommandResults(commandHeader, (variant) => getDangerousRecursiveForceTargets(variant, depth + 1, positionals, workingDir, previousWorkingDir, extglobEnabled, globEnabled));
  const targets = staticTargets ?? [];
  if (commandHeader !== command) targets.push(...shellScriptInputCommandStrings(
    command,
    splitCommandTokens(commandHeader),
    tokensStartWithShell,
  ).concat(pipedShellScriptInputCommandStrings(command, splitCommandTokens, tokensStartWithShell))
    .flatMap((scriptCommand) => getDangerousRecursiveForceTargets(scriptCommand, depth + 1, positionals, workingDir, '', false)));
  if (staticTargets) return targets;
  targets.push(...staticShellLoopCommandStrings(commandHeader)
    .flatMap((bodyCommand) => getDangerousRecursiveForceTargets(bodyCommand, depth + 1, positionals, workingDir, '', extglobEnabled, globEnabled)));
  let workingDirState = initialWorkingDirState(workingDir, previousWorkingDir);
  const shellFunctions = new Map<string, string>();
  const trapCommands: ShellTrapActionCommand[] = [];

  for (const statement of splitShellCommandListSegments(commandHeader)) {
    const controlCommand = stripShellControlCommandPrefix(statement);
    const shellCommand = resolveShellFunctionCommand(controlCommand, shellFunctions);
    if (shellCommand === null) continue;
    if (shellCommand !== controlCommand) {
      const functionPositionals = shellFunctionInvocationPositionals(controlCommand, positionals);
      const functionCommand = withShellFunctionInvocationPrefixAssignments(controlCommand, shellCommand);
      targets.push(...staticAssignmentCommandVariantResults(functionCommand, (variant) => getDangerousRecursiveForceTargets(variant, depth + 1, functionPositionals, workingDirState.current, workingDirState.previous, extglobEnabled, globEnabled), { allowLocalDeclarations: true }));
      targets.push(...getDangerousRecursiveForceTargets(functionCommand, depth + 1, functionPositionals, workingDirState.current, workingDirState.previous, extglobEnabled, globEnabled));
      workingDirState = nextStaticShellCommandWorkingDirState(functionCommand, workingDirState, splitCommandTokens, functionPositionals);
      continue;
    }

    const trapCommand = shellTrapActionCommandFromStatement(shellCommand, shellFunctions, splitCommandTokens, positionals);
    if (trapCommand) trapCommands.push(trapCommand);
    targets.push(...getStatementDangerousRecursiveForceTargets(shellCommand, depth, positionals, workingDirState.current, workingDirState.previous, shellFunctions, extglobEnabled, globEnabled));
    workingDirState = nextStaticShellCommandWorkingDirState(shellCommand, workingDirState, splitCommandTokens, positionals);
    globEnabled = nextShellCommandGlobEnabled(shellCommand, globEnabled, splitCommandTokens);
  }

  targets.push(...trapCommands.flatMap((trapCommand) => {
    const resolved = resolveShellTrapActionCommand(trapCommand, shellFunctions);
    return getDangerousRecursiveForceTargets(resolved.command, depth + 1, resolved.positionals, workingDirState.current, workingDirState.previous, extglobEnabled, globEnabled);
  }));

  return targets;
}

function getStatementDangerousRecursiveForceTargets(
  statement: string,
  depth: number,
  positionals?: ShellPositionalArguments, workingDir = '', previousWorkingDir = '',
  shellFunctions = new Map<string, string>(), extglobEnabled = false, globEnabled = true,
): string[] {
  const pipeSegments = splitShellSegments(statement, (char) => char === '|');
  const caseCommands = shellCaseBranchCommandStrings(statement);
  return [
    ...caseCommands.flatMap((command) => getDangerousRecursiveForceTargets(command, depth + 1, positionals, workingDir, previousWorkingDir, extglobEnabled, globEnabled)),
    ...pipeSegments.flatMap((segment) => getSegmentDangerousRecursiveForceTargets(segment, depth, positionals, workingDir, previousWorkingDir, shellFunctions, extglobEnabled, globEnabled)),
    ...getShellCommandPipedXargsDangerousRecursiveForceTargets(
      statement, splitCommandTokens, getShellTokensCommandStringDangerousTargets, tokensStartWithShell, depth, positionals, workingDir,
    ).map((target) => targetWithWorkingDir(target, workingDir, previousWorkingDir)),
    ...pipedShellScriptInputCommandStrings(statement, splitCommandTokens, tokensStartWithShell)
      .flatMap((script) => getDangerousRecursiveForceTargets(script, depth + 1, positionals, workingDir, '', false)),
  ];
}

function tokenResolvesToCommand(token: string, commands: Set<string>): boolean {
  if (commands.has(getShellTokenBasename(token))) return true;
  if (commandSubstitutionTokenResolvesToCommand(token, commands)) return true;
  const [splitToken] = splitShellWords(unquoteShellToken(token));
  return splitToken ? commands.has(getShellTokenBasename(splitToken)) : false;
}

const tokenResolvesToShell = (token: string): boolean => tokenResolvesToCommand(token, SHELL_COMMANDS);

function splitCommandTokens(command: string, keepAssignmentPrefixes = false): string[] {
  const tokens = mergeWholeCommandSubstitutionTokens(splitShellWords(command));
  return expandLeadingCommandSubstitutionTokens(keepAssignmentPrefixes ? tokens : withoutShellAssignmentPrefixes(tokens));
}

function tokensStartWithShell(tokens: string[]): boolean {
  const first = shellExecutableCommandTokens(tokens)[0];
  return Boolean(first && tokenResolvesToShell(first));
}

function getShellCommandStringDangerousTargets(
  segment: string,
  depth: number,
  positionals?: ShellPositionalArguments,
  workingDir = '',
): string[] {
  return shellCommandStringTokenGroups(splitCommandTokens(segment, true), tokensStartWithShell)
    .flatMap((shellTokens) => getShellTokensCommandStringDangerousTargets(
      shellTokens,
      depth,
      positionals,
      workingDir,
    ));
}

function getShellTokensCommandStringDangerousTargets(
  shellTokens: string[],
  depth: number,
  positionals?: ShellPositionalArguments,
  workingDir = '',
): string[] {
  const invocation = firstShellCommandStringInvocation(shellTokens, tokenResolvesToShell);
  if (!invocation.commandString) return [];

  return getDangerousRecursiveForceTargets(
    invocation.commandString,
    depth + 1,
    shellCommandStringPositionals(invocation, positionals),
    workingDir,
    '',
    invocation.extglobEnabled,
    invocation.globEnabled,
  );
}

function getSegmentDangerousRecursiveForceTargets(
  segment: string,
  depth: number,
  positionals?: ShellPositionalArguments, workingDir = '', previousWorkingDir = '',
  shellFunctions = new Map<string, string>(), extglobEnabled = false, globEnabled = true,
): string[] {
  const command = unwrapShellGroupCommand(segment, { stripTrailingTerminator: true });
  if (command !== segment) return getDangerousRecursiveForceTargets(command, depth, positionals, workingDir, previousWorkingDir, extglobEnabled, globEnabled);

  const commandHeader = stripHereDocBodies(command);
  const evalCommand = evalCommandString(splitCommandTokens(commandHeader, true));
  if (evalCommand) return getDangerousRecursiveForceTargets(evalCommand, depth + 1, positionals, workingDir, previousWorkingDir, extglobEnabled, globEnabled);
  const tokens = splitCommandTokens(commandHeader);
  const trapCommand = shellTrapActionCommand(tokens, shellFunctions, positionals);

  const targets = [
    ...dangerousRmInvocations(tokens)
      .flatMap((invocation) => invocation.targets)
      .flatMap((target) => shellPositionalTargetTokens(target, positionals)),
    ...hostedExecutableCommandTokenGroups(tokens).flatMap((commandTokens) => dangerousRmInvocations(commandTokens)).flatMap((invocation) => invocation.targets).flatMap((target) => shellPositionalTargetTokens(target, positionals)),
    ...getFindExecDangerousRecursiveForceTargets(tokens, depth, positionals, workingDir, getShellTokensCommandStringDangerousTargets),
  ];

  return [
    ...markShellGlobStateTargets(
      targets.map((target) => targetWithWorkingDir(target, workingDir, previousWorkingDir)),
      extglobEnabled,
      globEnabled,
    ),
    ...shellScriptInputCommandStrings(command, tokens, tokensStartWithShell)
      .flatMap((scriptCommand) => getDangerousRecursiveForceTargets(scriptCommand, depth + 1, positionals, workingDir, '', false)),
    ...hostedShellCommandStrings(tokens).flatMap((scriptCommand) => getDangerousRecursiveForceTargets(scriptCommand, depth + 1, positionals, workingDir, '', false)),
    ...(trapCommand ? getDangerousRecursiveForceTargets(trapCommand.command, depth + 1, trapCommand.positionals, workingDir, previousWorkingDir, extglobEnabled, globEnabled) : []),
    ...getShellCommandStringDangerousTargets(commandHeader, depth, positionals, workingDir),
  ];
}

export function isRmRecursiveForceTargetingRoot(command: string, workingDir = ''): boolean {
  return getDangerousRecursiveForceTargets(command, 0, undefined, workingDir)
    .some((target) => tokenTargetsRoot(target, workingDir));
}

export function isRmRecursiveForceTargetingHome(command: string): boolean {
  return getDangerousRecursiveForceTargets(command).some(tokenTargetsHome);
}
