import { splitShellPipelineSegments } from './shell-pipeline-command.utils';
import type {
  StaticShellCommandStatus,
  StaticShellCommandStatusOptions,
  StaticShellCommandStatusResolver,
} from './shell-static-command-status.types';
import { cloneStaticShellCommandStatusOptions } from './shell-static-option-command.utils';

export function staticShellPipelineCommandStatus(
  statement: string,
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  const segments = splitShellPipelineSegments(statement);
  if (segments.length <= 1) return null;

  if (options.pipefail) return staticShellPipefailPipelineStatus(segments, resolveStatus, options);

  const finalSegment = segments.at(-1);
  return finalSegment === undefined ? true : resolveStatus(finalSegment, options);
}

function staticShellPipefailPipelineStatus(
  segments: string[],
  resolveStatus: StaticShellCommandStatusResolver,
  options: StaticShellCommandStatusOptions,
): StaticShellCommandStatus {
  let hasUnknown = false;

  for (const segment of segments) {
    const status = resolveStatus(segment, cloneStaticShellCommandStatusOptions(options));
    if (status === false) return false;
    if (status === null) hasUnknown = true;
  }

  return hasUnknown ? null : true;
}
