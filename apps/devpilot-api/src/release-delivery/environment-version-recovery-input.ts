import { UnprocessableEntityException } from "@nestjs/common";
import type { EnvironmentVersionRepository } from "./environment-version.repository";
import type { EnvironmentVersionExecuteInput } from "./environment-version-execution.types";

export async function resolveEnvironmentVersionRecoveryInput(
  repository: EnvironmentVersionRepository,
  input: EnvironmentVersionExecuteInput,
  environment: { id: string; baselineRole: string | null },
) {
  if (
    input.kind !== "recovery" ||
    environment.baselineRole !== "production" ||
    input.sourceVersionId
  ) return input;
  if (!input.releaseRunId) {
    throw new UnprocessableEntityException(
      "Production 回退必须绑定已批准的 Recovery ReleaseRun",
    );
  }
  const sourceVersionId = await repository.recoverySourceVersionId(
    input.teamId,
    input.projectId,
    environment.id,
    input.releaseRunId,
  );
  if (!sourceVersionId) {
    throw new UnprocessableEntityException(
      "Production 回退 ReleaseRun 未指向可用的历史环境版本",
    );
  }
  return { ...input, sourceVersionId };
}
