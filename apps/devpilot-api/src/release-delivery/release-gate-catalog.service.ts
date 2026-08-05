import { Injectable } from "@nestjs/common";
import { previewReleaseBuildGate } from "./release-build-gate-admission";
import { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import { ReleaseGateDecisionService } from "./release-gate-decision.service";
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
    const { evaluation, decisions } = await this.decisionPolicy.catalog(
      scope,
      await previewReleaseBuildGate(this.sources, scope),
    );
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
