import { Injectable, NotFoundException } from "@nestjs/common";
import { ReleaseOrderEvidenceRepository } from "./release-order-evidence.repository";
import { presentReleaseOrderEvidence } from "./release-order-evidence.presenter";

@Injectable()
export class ReleaseOrderEvidenceService {
  constructor(private readonly repository: ReleaseOrderEvidenceRepository) {}

  async get(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    take: number,
  ) {
    const evidence = await this.repository.find(
      teamId,
      projectId,
      releaseOrderId,
      take,
    );
    if (!evidence) throw new NotFoundException("发布单不存在或不属于当前项目");
    return presentReleaseOrderEvidence(evidence);
  }
}
