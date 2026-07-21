import { splitShellCommandListSegments } from './shell-command-list.utils';
import { getShellTokenBasename, splitShellWords, unquoteShellToken } from './shell-command.utils';
import { commandSubstitutionTokenResolvesToCommand, expandLeadingCommandSubstitutionTokens, mergeWholeCommandSubstitutionTokens } from './command-substitution-token.utils';
import { evalCommandString } from './eval-command-string.utils';
import { containsBacktickCommandSubstitutionCommand, containsCommandSubstitutionCommand, containsInputProcessSubstitutionCommand } from './process-substitution.utils';
import { pipedShellScriptInputCommandStrings } from './piped-shell-script-input-command.utils';
import { firstShellCommandStringInvocation } from './shell-c-command.utils';
import { shellCaseBranchCommandStrings } from './shell-case-command.utils';
import { SHELL_COMMANDS } from './shell-command-name.constants';
import { expandShellCommandStringPositionals } from './shell-command-string-positionals.utils';
import { withoutShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { stripShellControlCommandPrefix } from './shell-control-command.utils';
import { shellExecutableCommandTokens } from './shell-executable-command.utils';
import { staticShellLoopCommandStrings } from './shell-for-loop-command.utils';
import { shellScriptInputCommandStrings, stripHereDocBodies } from './shell-script-input-command.utils';
import { shellCommandStringTokenGroups, shellCommandTokens } from './shell-launcher-command.utils';
import { shellScriptInvocation } from './shell-script-invocation.utils';
import { isShellStdinPath } from './shell-stdin-path.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import { commandListHasRemoteFetchPipeline } from './remote-shell-pipeline-command.utils';
import { commandTokensRedirectStdout, remoteOutputProcessSubstitutionReceivesShell, shellCommandTokensWithoutOutputRedirections } from './remote-shell-process-substitution.utils';
import { xargsShellCommandStrings } from './remote-shell-xargs-command-string.utils';
import { shellCommandStringPositionals } from './shell-positional-parameter.utils';
import { shellParameterOperatorWordToken } from './shell-parameter-word.utils';
import { shellFunctionOrTrapReceivesRemoteFetch } from './remote-shell-function-trap-command.utils';
import { hasStaticAssignmentCommandVariant } from './shell-static-assignment-variant.utils';
import { commandTokensStartWithFetchStdout } from './remote-fetch-stdout-command.utils';
import { shellCommandStringTokensWithAssignmentPrefixes } from './shell-command-string-assignment-prefix-tokens.utils';
import { bashEnvStartupReceivesRemoteFetch } from './remote-shell-bash-env-startup.utils';
const FETCH_COMMANDS = new Set(['curl', 'wget']); const SHELL_SOURCE_COMMANDS = new Set(['source', '.']);
const SHELL_EVAL_COMMANDS = new Set(['eval']);
function splitCommandList(segment: string): string[] {
  return splitShellCommandListSegments(segment).map(stripShellControlCommandPrefix);
}

function tokenResolvesToCommand(token: string, commands: Set<string>): boolean {
  if (commands.has(getShellTokenBasename(token))) return true;
  if (commandSubstitutionTokenResolvesToCommand(token, commands)) return true;
  const defaultToken = shellParameterOperatorWordToken(token);
  if (defaultToken && tokenResolvesToCommand(defaultToken, commands)) return true;
  const [splitToken] = splitShellWords(unquoteShellToken(token));
  return splitToken ? commands.has(getShellTokenBasename(splitToken)) : false;
}

const tokenResolvesToShell = (token: string): boolean => tokenResolvesToCommand(token, SHELL_COMMANDS);
const tokenResolvesToFetch = (token: string): boolean => tokenResolvesToCommand(token, FETCH_COMMANDS);

function splitCommandTokens(command: string): string[] {
  return expandLeadingCommandSubstitutionTokens(withoutShellAssignmentPrefixes(
    mergeWholeCommandSubstitutionTokens(splitShellWords(unwrapShellGroupCommand(command))),
  ));
}

function segmentStartsWithFetch(command: string): boolean {
  return commandTokensStartWithFetchStdout(
    splitUnquotedIfsExpansionTokens(splitCommandTokens(command)),
    tokenResolvesToFetch,
  );
}

function tokensStartWithShell(tokens: string[]): boolean {
  const first = shellExecutableCommandTokens(tokens)[0];
  return Boolean(first && tokenResolvesToShell(first));
}

function shellReceivesPipeProcessSubstitution(segment: string): boolean {
  return remoteOutputProcessSubstitutionReceivesShell(
    segment,
    splitCommandTokens,
    startsWithShellCommand,
    segmentStartsWithFetch,
  );
}

function containsFetchCommand(segment: string): boolean {
  return splitCommandList(unwrapShellGroupCommand(segment)).some(segmentStartsWithFetch);
}

function containsFetchDeliveryCommand(segment: string): boolean {
  return containsFetchCommand(segment)
    || containsInputProcessSubstitutionCommand(segment, containsFetchCommand)
    || containsCommandSubstitutionCommand(segment, containsFetchCommand)
    || containsBacktickCommandSubstitutionCommand(segment, containsFetchCommand);
}

function startsWithShellCommand(segment: string): boolean {
  const groupCommand = unwrapShellGroupCommand(segment, { stripTrailingTerminator: true });
  if (groupCommand !== segment) return splitCommandList(groupCommand).some(startsWithShellCommand);
  const [firstCommand = ''] = splitCommandList(segment);
  const tokens = splitUnquotedIfsExpansionTokens(
    shellCommandTokensWithoutOutputRedirections(splitCommandTokens(firstCommand)),
  );
  if (getShellTokenBasename(tokens[0] ?? '') === 'xargs') {
    return shellCommandTokens(tokens, tokensStartWithShell).length > 0;
  }
  if (SHELL_SOURCE_COMMANDS.has(getShellTokenBasename(tokens[0] ?? ''))) return tokens.slice(1).some(isShellStdinPath);
  const executableTokens = shellExecutableCommandTokens(tokens);
  const shellToken = shellParameterOperatorWordToken(executableTokens[0] ?? '') || executableTokens[0];
  return Boolean(shellScriptInvocation([shellToken, ...executableTokens.slice(1)], tokensStartWithShell)?.readsStdin);
}

function shellReceivesFetchSubstitution(command: string): boolean {
  return splitCommandList(command).some(
    (segment) => {
      const tokens = splitUnquotedIfsExpansionTokens(splitCommandTokens(segment));
      const [first] = tokens;
      if (!first) return false;
      if (tokensStartWithShell(tokens)) {
        return containsInputProcessSubstitutionCommand(segment, containsFetchDeliveryCommand);
      }

      const firstName = getShellTokenBasename(first);
      if (SHELL_SOURCE_COMMANDS.has(firstName)) {
        return containsInputProcessSubstitutionCommand(segment, containsFetchDeliveryCommand);
      }
      if (SHELL_EVAL_COMMANDS.has(firstName)) {
        return containsCommandSubstitutionCommand(segment, containsFetchDeliveryCommand)
          || containsBacktickCommandSubstitutionCommand(segment, containsFetchDeliveryCommand);
      }

      return false;
    },
  );
}

function shellReceivesFetchCommandStringSegment(segment: string, depth: number, workingDir: string): boolean {
  const shellTokenGroups = shellCommandStringTokenGroups(shellCommandStringTokensWithAssignmentPrefixes(segment), tokensStartWithShell);
  return shellTokenGroups.some((shellTokens) => {
    const invocation = firstShellCommandStringInvocation(shellTokens, tokenResolvesToShell);
    const commandString = expandShellCommandStringPositionals(
      invocation.commandString,
      shellCommandStringPositionals(invocation),
    );
    if (!commandString) return false;
    if (
      containsCommandSubstitutionCommand(commandString, containsFetchDeliveryCommand)
      || containsBacktickCommandSubstitutionCommand(commandString, containsFetchDeliveryCommand)
    ) return true;

    return isRemoteFetchPipedToShellCommand(commandString, depth + 1, workingDir);
  });
}

function shellReceivesFetchCommandString(command: string, depth: number, workingDir: string): boolean {
  return splitCommandList(command).some((segment) => splitShellPipelineSegments(segment)
    .some((pipeSegment) => shellReceivesFetchCommandStringSegment(pipeSegment, depth, workingDir)));
}

function evalReceivesRemoteFetch(command: string, depth: number, workingDir: string): boolean {
  return splitCommandList(command).some((segment) => {
    const commandString = evalCommandString(shellCommandStringTokensWithAssignmentPrefixes(segment));
    return Boolean(commandString && isRemoteFetchPipedToShellCommand(commandString, depth + 1, workingDir));
  });
}
function shellScriptInputReceivesRemoteFetch(command: string, commandHeader: string, depth: number, workingDir: string): boolean {
  const receivesRemoteFetch = (scriptCommand: string) => containsCommandSubstitutionCommand(scriptCommand, containsFetchDeliveryCommand)
    || containsBacktickCommandSubstitutionCommand(scriptCommand, containsFetchDeliveryCommand)
    || isRemoteFetchPipedToShellCommand(scriptCommand, depth + 1, workingDir);
  return (commandHeader === command ? [] : pipedShellScriptInputCommandStrings(command, splitCommandTokens, tokensStartWithShell)).some(receivesRemoteFetch)
    || splitCommandList(commandHeader).some((segment) => shellScriptInputCommandStrings(command, splitCommandTokens(segment), tokensStartWithShell)
    .concat(pipedShellScriptInputCommandStrings(segment, splitCommandTokens, tokensStartWithShell))
    .some(receivesRemoteFetch));
}
function isRemoteFetchPipedToShellCommand(command: string, depth: number, workingDir: string): boolean {
  if (depth > 5) return false;
  const receivesRemoteFetch = (nextCommand: string, nextDepth: number) => isRemoteFetchPipedToShellCommand(nextCommand, nextDepth, workingDir);
  if (hasStaticAssignmentCommandVariant(command, (variant) => receivesRemoteFetch(variant, depth + 1))) return true;
  const commandHeader = stripHereDocBodies(command);
  if (
    shellScriptInputReceivesRemoteFetch(command, commandHeader, depth, workingDir)
    || bashEnvStartupReceivesRemoteFetch(
      command,
      depth,
      tokensStartWithShell,
      tokenResolvesToShell,
      receivesRemoteFetch,
      workingDir,
    )
  ) return true;
  if (evalReceivesRemoteFetch(commandHeader, depth, workingDir)) return true;
  if (shellFunctionOrTrapReceivesRemoteFetch(commandHeader, depth, splitCommandTokens, tokensStartWithShell, tokenResolvesToShell, receivesRemoteFetch, workingDir)) return true;
  if (xargsShellCommandStrings(commandHeader, tokensStartWithShell, tokenResolvesToShell).some((script) => containsCommandSubstitutionCommand(script, containsFetchDeliveryCommand) || containsBacktickCommandSubstitutionCommand(script, containsFetchDeliveryCommand) || receivesRemoteFetch(script, depth + 1))) return true;
  if (shellReceivesFetchCommandString(commandHeader, depth, workingDir)) return true;
  if (shellReceivesFetchSubstitution(commandHeader)) return true;
  if (shellCaseBranchCommandStrings(commandHeader).some((script) => receivesRemoteFetch(script, depth + 1))) return true;
  if (staticShellLoopCommandStrings(commandHeader).some((script) => receivesRemoteFetch(script, depth + 1))) return true;
  return commandListHasRemoteFetchPipeline(
    splitCommandList(commandHeader),
    containsFetchDeliveryCommand,
    startsWithShellCommand,
    shellReceivesPipeProcessSubstitution,
    (segment) => commandTokensRedirectStdout(splitCommandTokens(segment)),
  );
}

export function isRemoteFetchPipedToShell(command: string, workingDir = ''): boolean {
  return isRemoteFetchPipedToShellCommand(command, 0, workingDir);
}
