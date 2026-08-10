import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import type { EnvironmentVersionExecuteInput } from "./environment-version-execution.types";

export function environmentVersionRequestHash(
  input: EnvironmentVersionExecuteInput,
) {
  return hashCanonicalReleaseValue({
    teamId: input.teamId,
    projectId: input.projectId,
    actorId: input.actorId,
    environmentId: input.environmentId,
    kind: input.kind,
    manifestId: input.manifestId ?? null,
    sourceVersionId: input.sourceVersionId ?? null,
    releaseRunId: input.releaseRunId ?? null,
  });
}
