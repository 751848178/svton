import { Injectable } from "@nestjs/common";
import { EnvironmentVersionRecoveryRepository } from "./environment-version-recovery.repository";
import { ReleaseStagingExecutorPort } from "./release-staging.types";

@Injectable()
export class EnvironmentVersionRecoveryService {
  constructor(
    private readonly repository: EnvironmentVersionRecoveryRepository,
    private readonly executor: ReleaseStagingExecutorPort,
  ) {}

  preview(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    sourceVersionId: string;
  }) {
    return this.repository.preview({
      ...input, providerKey: this.executor.providerKey,
    });
  }

  confirm(input: {
    teamId: string;
    actorId: string;
    projectId: string;
    environmentId: string;
    sourceVersionId: string;
    expectedInputHash: string;
    idempotencyKey: string;
  }) {
    return this.repository.confirm({
      ...input, providerKey: this.executor.providerKey,
    });
  }
}
