import { Injectable } from "@nestjs/common";
import type { CreateReleasePolicyRevisionDto } from "./dto/release-policy.dto";
import { ReleasePolicyRepository } from "./release-policy.repository";
import { ReleaseStrategyCapabilityService } from "./release-strategy-capability.service";

@Injectable()
export class ReleasePolicyService {
  constructor(
    private readonly repository: ReleasePolicyRepository,
    private readonly capabilities: ReleaseStrategyCapabilityService,
  ) {}

  async get(teamId: string, projectId: string) {
    const current = await this.repository.get(teamId, projectId);
    return this.response(current ?? {
      id: null,
      revision: 0,
      strategy: "standard",
      requireProductionApproval: true,
      changeWindow: null,
      freezePolicy: null,
      snapshotHash: "default-standard-policy-v1",
      createdAt: null,
      createdBy: null,
      synthetic: true,
    });
  }

  async create(
    teamId: string,
    projectId: string,
    actorId: string,
    dto: CreateReleasePolicyRevisionDto,
  ) {
    this.capabilities.requireExecutable(dto.strategy);
    const current = await this.repository.create(teamId, projectId, actorId, dto);
    return this.response(current);
  }

  private response(current: Record<string, unknown>) {
    return { current, capabilities: this.capabilities.list() };
  }
}
