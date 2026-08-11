import { Injectable } from "@nestjs/common";
import { previewReleaseBuildGate } from "./release-build-gate-admission";
import { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
import { ReleaseDeploymentTargetReadinessService } from "./release-deployment-target-readiness.service";
import {
  RELEASE_GATE_CAPABILITY_VERSION,
  RELEASE_GATE_CATALOG_VERSION,
  RELEASE_GATE_STATUSES,
  type ReleaseGatePhase,
  type ReleaseGateStatus,
} from "./release-gate-catalog.types";

const PHASES: ReleaseGatePhase[] = ["commit", "build", "deploy", "promote"];

@Injectable()
export class ReleaseGateCatalogService {
  constructor(
    private readonly decisionPolicy: ReleaseGateDecisionService,
    private readonly sources: ReleaseBuildSourceResolverService,
    private readonly targets: ReleaseDeploymentTargetReadinessService,
  ) {}

  async get(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    actorId: string,
  ) {
    const scope = {
      teamId,
      projectId,
      releaseOrderId,
      actorId,
    };
    const [gateResult, targetReadiness] = await Promise.all([
      previewReleaseBuildGate(this.sources, scope).then((input) =>
        this.decisionPolicy.catalog(scope, input),
      ),
      this.targets.get(teamId, projectId),
    ]);
    const { evaluation, decisions } = gateResult;
    const { order, checks, capabilities } = evaluation;
    const phaseCounts = Object.fromEntries(
      PHASES.map((phase) => [
        phase,
        checks.filter((check) => check.phase === phase).length,
      ]),
    );
    const statusCounts = Object.fromEntries(
      RELEASE_GATE_STATUSES.map((status) => [
        status,
        this.countStatus(checks, status),
      ]),
    );
    return {
      catalogVersion: RELEASE_GATE_CATALOG_VERSION,
      capabilityVersion: RELEASE_GATE_CAPABILITY_VERSION,
      releaseOrder: { id: order.id, releaseVersion: order.releaseVersion },
      summary: { total: checks.length, phaseCounts, statusCounts },
      decisions,
      targetReadiness,
      capabilities,
      checks,
    };
  }

  private countStatus(
    checks: Array<{ status: ReleaseGateStatus }>,
    status: ReleaseGateStatus,
  ) {
    return checks.filter((check) => check.status === status).length;
  }
}
