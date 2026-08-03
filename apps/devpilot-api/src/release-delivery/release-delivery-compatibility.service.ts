import { Injectable } from "@nestjs/common";
import { ReleaseDeliveryCompatibilityRepository } from "./release-delivery-compatibility.repository";
import { buildReleaseDeliveryMigrationReport } from "./release-delivery-migration-report.utils";

@Injectable()
export class ReleaseDeliveryCompatibilityService {
  constructor(
    private readonly repository: ReleaseDeliveryCompatibilityRepository,
  ) {}

  async get(teamId: string, projectId: string) {
    const snapshot = await this.repository.snapshot(teamId, projectId);
    const report = buildReleaseDeliveryMigrationReport(snapshot);
    return {
      schemaVersion: 1,
      mode: "read_only_compatibility",
      project: snapshot.project,
      executionBoundary: {
        newDeliveryInput: "persisted_artifact_manifest",
        checkoutDuringDeployment: false,
        buildDuringDeployment: false,
        legacyBranchDeploymentForGovernedProject: false,
      },
      report,
      history: {
        releasePlans: snapshot.releasePlans.length,
        deploymentRuns: snapshot.history.map((run) => ({
          ...run,
          classification: run.artifactManifestId
            ? "manifest_verified"
            : "legacy_unverified",
          readOnly: true,
          detailsHref: `/deployments/runs/${run.id}`,
        })),
        logStreams: snapshot.logStreams,
        logEntries: snapshot.logEntries,
      },
    };
  }
}

