import { Injectable } from "@nestjs/common";
import { buildReleaseStagingWorkloadSnapshot } from "./release-staging-workload-snapshot.utils";
import {
  ReleaseStagingWorkloadScope,
  ReleaseStagingWorkloadStateRepository,
} from "./release-staging-workload-state.repository";

@Injectable()
export class ReleaseProductionWorkloadService {
  constructor(
    private readonly repository: ReleaseStagingWorkloadStateRepository,
  ) {}

  async prepare(scope: ReleaseStagingWorkloadScope) {
    return buildReleaseStagingWorkloadSnapshot(
      await this.repository.load({ ...scope, baselineRole: "production" }),
      "Production",
    );
  }
}
