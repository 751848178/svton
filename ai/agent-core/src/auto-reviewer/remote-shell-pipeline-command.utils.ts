import { splitShellPipelineSegments } from './shell-pipeline-command.utils';

type SegmentPredicate = (segment: string) => boolean;

export function commandListHasRemoteFetchPipeline(
  commandListSegments: string[],
  containsFetchCommand: SegmentPredicate,
  startsWithShellCommand: SegmentPredicate,
  shellReceivesPipeProcessSubstitution: SegmentPredicate,
  segmentRedirectsStdout: SegmentPredicate,
): boolean {
  return commandListSegments.some((commandSegment) => segmentHasRemoteFetchPipeline(
    commandSegment,
    containsFetchCommand,
    startsWithShellCommand,
    shellReceivesPipeProcessSubstitution,
    segmentRedirectsStdout,
  ));
}

function segmentHasRemoteFetchPipeline(
  commandSegment: string,
  containsFetchCommand: SegmentPredicate,
  startsWithShellCommand: SegmentPredicate,
  shellReceivesPipeProcessSubstitution: SegmentPredicate,
  segmentRedirectsStdout: SegmentPredicate,
): boolean {
  let hasFetchOutput = false;

  for (const segment of splitShellPipelineSegments(commandSegment)) {
    const segmentHasFetchOutput = containsFetchCommand(segment);
    if (segmentHasFetchOutput && shellReceivesPipeProcessSubstitution(segment)) return true;
    if (hasFetchOutput && startsWithShellCommand(segment)) return true;
    if (hasFetchOutput && shellReceivesPipeProcessSubstitution(segment)) return true;
    if (segmentHasFetchOutput) hasFetchOutput = true;
    else if (hasFetchOutput && segmentRedirectsStdout(segment)) hasFetchOutput = false;
  }

  return false;
}
