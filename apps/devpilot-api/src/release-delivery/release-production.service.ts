import { ConflictException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { ReleaseProductionRepository } from "./release-production.repository";
import { ReleaseStrategyCapabilityService } from "./release-strategy-capability.service";
import type { ReleaseStrategy } from "./release-strategy-capability.types";
import { ReleaseProductionPreflightService } from "./release-production-preflight.service";

@Injectable()
export class ReleaseProductionService {
  constructor(
    private readonly repository: ReleaseProductionRepository,
    private readonly capabilities: ReleaseStrategyCapabilityService,
    private readonly preflight: ReleaseProductionPreflightService,
  ) {}

  async preview(
    teamId: string,
    projectId: string,
    orderId: string,
    manifestId: string,
    strategy: ReleaseStrategy = "standard",
    actorId?: string,
  ) {
    this.capabilities.requireExecutable(strategy);
    const preview = await this.repository.preview(
      teamId, projectId, orderId, manifestId, strategy,
    );
    if (!actorId) return preview;
    return {
      ...preview,
      preflight: await this.preflight.preview({
        teamId,
        projectId,
        releaseOrderId: orderId,
        actorId,
        preview,
      }),
    };
  }

  async list(teamId: string, projectId: string, releaseOrderId: string) {
    const items = await this.repository.list(teamId, projectId, releaseOrderId);
    return { items, total: items.length };
  }

  async refreshPreflight(
    teamId: string,
    projectId: string,
    orderId: string,
    manifestId: string,
    actorId: string,
    strategy: ReleaseStrategy = "standard",
  ) {
    this.capabilities.requireExecutable(strategy);
    const preview = await this.repository.preview(
      teamId, projectId, orderId, manifestId, strategy,
    );
    return {
      ...preview,
      preflight: await this.preflight.preview({
        teamId, projectId, releaseOrderId: orderId, actorId, preview,
        refreshEvidence: true,
      }),
    };
  }

  async confirm(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    manifestId: string;
    actorId: string;
    expectedInputHash: string;
    idempotencyKey: string;
    strategy?: ReleaseStrategy;
  }) {
    const strategy = input.strategy ?? "standard";
    this.capabilities.requireExecutable(strategy);
    const preview = await this.repository.preview(
      input.teamId, input.projectId, input.releaseOrderId,
      input.manifestId, strategy,
    );
    if (preview.inputHash !== input.expectedInputHash) {
      throw new ConflictException(
        "Production 配置、工作负载或策略已变化，请重新确认最新快照",
      );
    }
    const preflight = await this.preflight.preview({
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      actorId: input.actorId,
      preview,
    });
    if (preflight.decision.preApprovalAllowed !== true) {
      throw new UnprocessableEntityException({
        code: "PRODUCTION_PREFLIGHT_BLOCKED",
        message: "Production 前置检查未通过，不能创建审批",
        publicData: { decision: preflight.decision },
      });
    }
    return this.repository.confirm({
      ...input,
      strategy,
      providerKey: this.preflight.providerKey,
      admissionProof: preflight.admissionProof,
    });
  }
}
