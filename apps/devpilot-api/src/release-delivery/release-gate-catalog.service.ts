import { Injectable, NotFoundException } from "@nestjs/common";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { ReleaseGateCapabilityRegistryService } from "./release-gate-capability-registry.service";
import { ReleaseGateEvidenceRepository } from "./release-gate-evidence.repository";
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
    private readonly evidence: ReleaseGateEvidenceRepository,
    private readonly capabilities: ReleaseGateCapabilityRegistryService,
  ) {}

  async get(teamId: string, projectId: string, releaseOrderId: string) {
    const order = await this.evidence.load(teamId, projectId, releaseOrderId);
    if (!order) throw new NotFoundException("发布单不存在或不属于当前项目");
    const now = new Date();
    const checks = RELEASE_GATE_DEFINITIONS.map((definition) =>
      this.capabilities.evaluate(definition, order, now),
    );
    const phaseCounts = Object.fromEntries(
      PHASES.map((phase) => [phase, checks.filter((check) => check.phase === phase).length]),
    );
    const statusCounts = Object.fromEntries(
      RELEASE_GATE_STATUSES.map((status) => [status, this.countStatus(checks, status)]),
    );
    return {
      catalogVersion: RELEASE_GATE_CATALOG_VERSION,
      capabilityVersion: RELEASE_GATE_CAPABILITY_VERSION,
      releaseOrder: { id: order.id, releaseVersion: order.releaseVersion },
      summary: { total: checks.length, phaseCounts, statusCounts },
      capabilities: this.capabilities.list(order),
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
