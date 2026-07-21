import { literalCommandOutputToken } from './literal-command-output.utils';
import { firstShellCommandStringInvocation } from './shell-c-command.utils';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { getShellTokenBasename } from './shell-command.utils';
import { expandShellCommandStringPositionals } from './shell-command-string-positionals.utils';
import { splitShellAssignmentPrefixes } from './shell-assignment-prefix.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { shellCommandStringTokenGroups } from './shell-launcher-command.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import { shellCommandStringPositionals } from './shell-positional-parameter.utils';
import { shellCommandStringTokensWithAssignmentPrefixes } from './shell-command-string-assignment-prefix-tokens.utils';
import {
  firstXargsCommandIndex,
  xargsCommandTokenBatchVariants,
  xargsStdinArgumentBatches,
} from './xargs-command.utils';

type TokensStartWithShell = (tokens: string[]) => boolean;
type TokenResolvesToShell = (token: string) => boolean;

export function xargsShellCommandStrings(
  command: string,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
): string[] {
  return splitShellCommandListSegments(command).flatMap((segment) => {
    const pipeSegments = splitShellPipelineSegments(segment);
    return pipeSegments.flatMap((pipeSegment, index) => (
      index === 0 ? [] : xargsPipeSegmentShellCommandStrings(
        pipeSegments[index - 1],
        pipeSegment,
        tokensStartWithShell,
        tokenResolvesToShell,
      )
    ));
  });
}

function xargsPipeSegmentShellCommandStrings(
  producerSegment: string,
  consumerSegment: string,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
): string[] {
  const stdinTarget = literalCommandOutputToken(producerSegment);
  if (!stdinTarget) return [];

  return xargsPipelineConsumerCommands(consumerSegment).flatMap((command) => {
    const { assignmentPrefixes, commandTokens: xargsTokens } = splitShellAssignmentPrefixes(
      splitUnquotedIfsExpansionTokens(shellCommandStringTokensWithAssignmentPrefixes(command)),
    );
    if (getShellTokenBasename(xargsTokens[0] ?? '') !== 'xargs') return [];

    const stdinBatches = xargsStdinArgumentBatches(xargsTokens, stdinTarget);
    const commandIndex = firstXargsCommandIndex(xargsTokens);
    if (stdinBatches.length === 0 || commandIndex < 0) return [];

    return xargsCommandTokenBatchVariants(xargsTokens.slice(commandIndex), xargsTokens, stdinBatches)
      .flatMap((tokens) => shellCommandStrings(
        [...assignmentPrefixes, ...tokens],
        tokensStartWithShell,
        tokenResolvesToShell,
      ));
  });
}

function xargsPipelineConsumerCommands(segment: string): string[] {
  const groupCommand = unwrapShellGroupCommand(segment, { stripTrailingTerminator: true });
  return groupCommand === segment ? [segment] : splitShellCommandListSegments(groupCommand);
}

function shellCommandStrings(
  tokens: string[],
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
): string[] {
  return shellCommandStringTokenGroups(tokens, tokensStartWithShell)
    .map((shellTokens) => {
      const invocation = firstShellCommandStringInvocation(shellTokens, tokenResolvesToShell);
      return expandShellCommandStringPositionals(
        invocation.commandString,
        shellCommandStringPositionals(invocation),
      );
    })
    .filter(Boolean);
}
