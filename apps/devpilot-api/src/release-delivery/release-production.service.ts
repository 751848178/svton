import { Injectable } from "@nestjs/common";
import { ReleaseProductionRepository } from "./release-production.repository";

@Injectable()
export class ReleaseProductionService {
  constructor(private readonly repository: ReleaseProductionRepository) {}

  preview(
    teamId: string,
    projectId: string,
    orderId: string,
    manifestId: string,
  ) {
    return this.repository.preview(teamId, projectId, orderId, manifestId);
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
  }) {
    return this.repository.confirm(input);
  }
}
