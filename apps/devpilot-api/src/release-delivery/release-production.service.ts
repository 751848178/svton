import { Injectable } from "@nestjs/common";
import { ReleaseProductionRepository } from "./release-production.repository";
import { ReleaseStrategyCapabilityService } from "./release-strategy-capability.service";
import type { ReleaseStrategy } from "./release-strategy-capability.types";

@Injectable()
export class ReleaseProductionService {
  constructor(
    private readonly repository: ReleaseProductionRepository,
    private readonly capabilities: ReleaseStrategyCapabilityService,
  ) {}

  preview(
    teamId: string,
    projectId: string,
    orderId: string,
    manifestId: string,
    strategy: ReleaseStrategy = "standard",
  ) {
    this.capabilities.requireExecutable(strategy);
    return this.repository.preview(teamId, projectId, orderId, manifestId, strategy);
  }

  async list(teamId: string, projectId: string, releaseOrderId: string) {
    const items = await this.repository.list(teamId, projectId, releaseOrderId);
    return { items, total: items.length };
  }

  confirm(input: {
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
    return this.repository.confirm({ ...input, strategy });
  }
}
