import {
  commandSubstitutionTokenResolvesToCommand,
  expandLeadingCommandSubstitutionTokens,
  mergeWholeCommandSubstitutionTokens,
} from './command-substitution-token.utils';
import { commandSubstitutionOutputTokens } from './command-substitution-output-token.utils';
import { evalCommandString } from './eval-command-string.utils';
import { directFindDeleteTargets } from './find-delete-direct-targets.utils';
import { type FindDeleteTrapCommand, findDeleteTrapCommand, findDeleteTrapCommandFromStatement, resolveFindDeleteTrapCommand } from './find-delete-trap-command.utils';
import { pipedXargsCommandTokenVariants } from './piped-xargs-command.utils';
import { nextStaticShellCommandWorkingDirState } from './rm-command-working-dir-state.utils';
import { markShellGlobStateTargets, tokenTargetsHome, tokenTargetsRoot } from './rm-target.utils';
import { initialWorkingDirState } from './rm-working-dir.utils';
import { firstShellCommandStringInvocation } from './shell-c-command.utils';
import { shellCaseBranchCommandStrings } from './shell-case-command.utils';
import { SHELL_COMMANDS } from './shell-command-name.constants';
import { getShellTokenBasename, splitShellWords, unquoteShellToken } from './shell-command.utils';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { withoutShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { stripShellControlCommandPrefix } from './shell-control-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import { staticShellLoopCommandStrings } from './shell-for-loop-command.utils';
import { type ShellFunctionDefinitions, resolveShellFunctionCommand, shellFunctionInvocationPositionals, withShellFunctionInvocationPrefixAssignments } from './shell-function-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { shellCommandStringTokenGroups } from './shell-launcher-command.utils';
import { type ShellPositionalArguments, shellCommandStringPositionals, shellPositionalTargetTokens } from './shell-positional-parameter.utils';
import { shellScriptInputCommandStrings, stripHereDocBodies } from './shell-script-input-command.utils';
import { preferredStaticAssignmentCommandResults, staticAssignmentCommandVariantResults } from './shell-static-assignment-variant.utils';
import { nextShellCommandGlobEnabled } from './shell-glob-state.utils';

const MAX_FIND_DELETE_COMMAND_STRING_DEPTH = 5;

export function isFindDeleteTargetingRoot(command: string, workingDir = ''): boolean {
  return getFindDeleteTargetTokens(command, workingDir).some((target) => tokenTargetsRoot(target, workingDir));
}

export function isFindDeleteTargetingHome(command: string, workingDir = ''): boolean {
  return getFindDeleteTargetTokens(command, workingDir).some(tokenTargetsHome);
}

function getFindDeleteTargetTokens(
  command: string,
  workingDir: string,
  depth = 0,
  positionals?: ShellPositionalArguments,
  extglobEnabled = false,
  globEnabled = true,
): string[] {
  if (depth > MAX_FIND_DELETE_COMMAND_STRING_DEPTH) return [];

  const commandHeader = stripHereDocBodies(command);
  const staticTargets = preferredStaticAssignmentCommandResults(commandHeader, (variant) =>
    getFindDeleteTargetTokens(variant, workingDir, depth + 1, positionals, extglobEnabled, globEnabled));
  const targets = staticTargets ?? [];
  if (commandHeader !== command) targets.push(...shellScriptInputCommandStrings(
    command,
    splitCommandTokens(commandHeader),
    tokensStartWithShell,
  ).flatMap((scriptCommand) => getFindDeleteTargetTokens(scriptCommand, workingDir, depth + 1, positionals, false)));
  if (staticTargets) return targets;
  targets.push(...staticShellLoopCommandStrings(commandHeader)
    .flatMap((bodyCommand) => getFindDeleteTargetTokens(bodyCommand, workingDir, depth + 1, positionals, extglobEnabled, globEnabled)));
  const shellFunctions = new Map<string, string>();
  const trapCommands: FindDeleteTrapCommand[] = [];
  let workingDirState = initialWorkingDirState(workingDir);

  for (const statement of splitShellCommandListSegments(commandHeader)) {
    const controlCommand = stripShellControlCommandPrefix(statement);
    const shellCommand = resolveShellFunctionCommand(controlCommand, shellFunctions);
    if (shellCommand === null) continue;
    if (shellCommand !== controlCommand) {
      const functionPositionals = shellFunctionInvocationPositionals(controlCommand, positionals);
      const functionCommand = withShellFunctionInvocationPrefixAssignments(controlCommand, shellCommand);
      targets.push(...staticAssignmentCommandVariantResults(
        functionCommand,
        (variant) => getFindDeleteTargetTokens(variant, workingDir, depth + 1, functionPositionals, extglobEnabled, globEnabled),
        { allowLocalDeclarations: true },
      ));
      targets.push(...getFindDeleteTargetTokens(
        functionCommand,
        workingDir,
        depth + 1,
        functionPositionals,
        extglobEnabled,
        globEnabled,
      ));
      workingDirState = nextStaticShellCommandWorkingDirState(
        functionCommand,
        workingDirState,
        splitCommandTokens,
        functionPositionals,
      );
      continue;
    }

    const trapCommand = findDeleteTrapCommandFromStatement(shellCommand, shellFunctions, splitCommandTokens, positionals);
    if (trapCommand) trapCommands.push(trapCommand);
    targets.push(...findDeleteStatementTargets(
      shellCommand,
      workingDirState.current,
      workingDirState.previous,
      depth,
      positionals,
      shellFunctions,
      extglobEnabled,
      globEnabled,
    ));
    workingDirState = nextStaticShellCommandWorkingDirState(
      shellCommand,
      workingDirState,
      splitCommandTokens,
      positionals,
    );
    globEnabled = nextShellCommandGlobEnabled(shellCommand, globEnabled, splitCommandTokens);
  }

  targets.push(...trapCommands.flatMap((trapCommand) => {
    const resolved = resolveFindDeleteTrapCommand(trapCommand, shellFunctions);
    return getFindDeleteTargetTokens(resolved.command, workingDirState.current, depth + 1, resolved.positionals, extglobEnabled, globEnabled);
  }));

  return targets;
}

function findDeleteStatementTargets(
  statement: string,
  workingDir: string,
  previousWorkingDir: string,
  depth: number,
  positionals?: ShellPositionalArguments,
  shellFunctions?: ShellFunctionDefinitions,
  extglobEnabled = false,
  globEnabled = true,
): string[] {
  const groupCommand = unwrapShellGroupCommand(statement, { stripTrailingTerminator: true });
  if (groupCommand !== statement) return getFindDeleteTargetTokens(groupCommand, workingDir, depth, positionals, extglobEnabled, globEnabled);

  const commandHeader = stripHereDocBodies(statement);
  const prefixedTokens = splitCommandTokens(commandHeader, true).flatMap((token) => shellPositionalTargetTokens(token, positionals));
  const evalCommand = evalCommandString(prefixedTokens);
  if (evalCommand) return getFindDeleteTargetTokens(evalCommand, workingDir, depth + 1, positionals, extglobEnabled, globEnabled);
  const tokens = splitCommandTokens(commandHeader)
    .flatMap((token) => shellPositionalTargetTokens(token, positionals));
  const trapCommand = shellFunctions ? findDeleteTrapCommand(tokens, shellFunctions, positionals) : null;

  return [
    ...shellCaseBranchCommandStrings(statement)
      .flatMap((command) => getFindDeleteTargetTokens(command, workingDir, depth + 1, positionals, extglobEnabled, globEnabled)),
    ...(trapCommand ? getFindDeleteTargetTokens(trapCommand.command, workingDir, depth + 1, trapCommand.positionals, extglobEnabled, globEnabled) : []),
    ...markShellGlobStateTargets(directFindDeleteTargets(tokens, workingDir, previousWorkingDir), extglobEnabled, globEnabled),
    ...pipedXargsFindDeleteTargets(commandHeader, workingDir, previousWorkingDir),
    ...shellScriptInputCommandStrings(statement, tokens, tokensStartWithShell)
      .flatMap((scriptCommand) => getFindDeleteTargetTokens(scriptCommand, workingDir, depth + 1, positionals, false)),
    ...shellCommandStringTargets(commandHeader, depth, positionals, workingDir),
  ];
}

function pipedXargsFindDeleteTargets(command: string, workingDir: string, previousWorkingDir: string): string[] {
  return pipedXargsCommandTokenVariants(command, splitCommandTokens)
    .flatMap((tokens) => [
      ...directFindDeleteTargets(tokens, workingDir, previousWorkingDir),
      ...shellCommandStringTargets(tokens, 0, undefined, workingDir),
    ]);
}

function shellCommandStringTargets(
  command: string | string[],
  depth: number,
  positionals: ShellPositionalArguments | undefined,
  workingDir: string,
): string[] {
  const tokens = Array.isArray(command) ? command : splitCommandTokens(command, true);
  return shellCommandStringTokenGroups(tokens, tokensStartWithShell)
    .flatMap((shellTokens) => {
      const invocation = firstShellCommandStringInvocation(shellTokens, tokenResolvesToShell);
      if (!invocation.commandString) return [];
      return getFindDeleteTargetTokens(invocation.commandString, workingDir, depth + 1, shellCommandStringPositionals(invocation, positionals), invocation.extglobEnabled, invocation.globEnabled);
    });
}

function tokenResolvesToCommand(token: string, commands: Set<string>): boolean {
  if (commands.has(getShellTokenBasename(token))) return true;
  if (commandSubstitutionTokenResolvesToCommand(token, commands)) return true;
  const [splitToken] = splitShellWords(unquoteShellToken(token));
  return splitToken ? commands.has(getShellTokenBasename(splitToken)) : false;
}

const tokenResolvesToShell = (token: string): boolean => tokenResolvesToCommand(token, SHELL_COMMANDS);

function tokensStartWithShell(tokens: string[]): boolean {
  const first = shellExecutableCommandTokens(tokens)[0];
  return Boolean(first && tokenResolvesToShell(first));
}

function splitCommandTokens(command: string, keepAssignmentPrefixes = false): string[] {
  const tokens = mergeWholeCommandSubstitutionTokens(splitShellWords(command));
  return expandLeadingCommandSubstitutionTokens(keepAssignmentPrefixes ? tokens : withoutShellAssignmentPrefixes(tokens)).flatMap(commandSubstitutionOutputTokens);
}
