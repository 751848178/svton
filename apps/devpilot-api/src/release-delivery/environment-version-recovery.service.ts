import { Injectable } from "@nestjs/common";
import { EnvironmentVersionRecoveryRepository } from "./environment-version-recovery.repository";

@Injectable()
export class EnvironmentVersionRecoveryService {
  constructor(private readonly repository: EnvironmentVersionRecoveryRepository) {}

  preview(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    sourceVersionId: string;
  }) {
    return this.repository.preview(input);
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
    return this.repository.confirm(input);
  }
}
