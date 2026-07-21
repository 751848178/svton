import { literalCommandOutputToken } from './literal-command-output.utils';
import { splitShellCommandListSegments } from './shell-command-list.utils';
import { getShellTokenBasename } from './shell-command.utils';
import { unwrapShellGroupCommand } from './shell-group-command.utils';
import { splitUnquotedIfsExpansionTokens } from './shell-ifs-word-splitting.utils';
import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import { xargsArgFileArgumentBatches } from './xargs-arg-file.utils';
import {
  firstXargsCommandIndex,
  xargsCommandTokenBatchVariants,
  xargsStdinArgumentBatches,
} from './xargs-command.utils';

type SplitCommandTokens = (command: string) => string[];

export function pipedXargsCommandTokenVariants(
  command: string,
  splitCommandTokens: SplitCommandTokens,
): string[][] {
  return splitShellCommandListSegments(command).flatMap((segment) => [
    ...xargsArgFileSegmentCommandTokenVariants(segment, splitCommandTokens),
    ...pipedXargsSegmentCommandTokenVariants(splitShellPipelineSegments(segment), splitCommandTokens),
  ]);
}

function xargsArgFileSegmentCommandTokenVariants(
  segment: string,
  splitCommandTokens: SplitCommandTokens,
): string[][] {
  return xargsPipelineConsumerCommands(segment)
    .flatMap((command) => xargsInputCommandTokenVariants(splitCommandTokens(command), xargsArgFileArgumentBatches));
}

function pipedXargsSegmentCommandTokenVariants(
  pipeSegments: string[],
  splitCommandTokens: SplitCommandTokens,
): string[][] {
  const variants: string[][] = [];

  for (let index = 1; index < pipeSegments.length; index += 1) {
    const stdinTarget = literalCommandOutputToken(pipeSegments[index - 1]);
    if (!stdinTarget) continue;

    for (const command of xargsPipelineConsumerCommands(pipeSegments[index])) {
      const xargsTokens = splitCommandTokens(command);

      variants.push(...xargsInputCommandTokenVariants(
        xargsTokens,
        (tokens) => xargsStdinArgumentBatches(tokens, stdinTarget),
      ));
    }
  }

  return variants;
}

function xargsPipelineConsumerCommands(segment: string): string[] {
  const groupCommand = unwrapShellGroupCommand(segment, { stripTrailingTerminator: true });
  return groupCommand === segment ? [segment] : splitShellCommandListSegments(groupCommand);
}

function xargsInputCommandTokenVariants(
  xargsTokens: string[],
  stdinBatchesForTokens: (tokens: string[]) => string[][] | null,
): string[][] {
  const commandTokens = splitUnquotedIfsExpansionTokens(xargsTokens);
  if (getShellTokenBasename(commandTokens[0] ?? '') !== 'xargs') return [];

  const stdinBatches = stdinBatchesForTokens(commandTokens);
  const commandIndex = firstXargsCommandIndex(commandTokens);
  if (!stdinBatches || stdinBatches.length === 0 || commandIndex < 0) return [];

  return xargsCommandTokenBatchVariants(
    commandTokens.slice(commandIndex),
    commandTokens,
    stdinBatches,
  );
}
