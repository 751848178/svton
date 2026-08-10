import { Injectable } from "@nestjs/common";
import type { ReleaseOrderListQueryDto } from "./dto/release-order-list-query.dto";
import { ReleaseOrderListRepository } from "./release-order-list.repository";

@Injectable()
export class ReleaseOrderListService {
  constructor(private readonly repository: ReleaseOrderListRepository) {}

  async list(
    teamId: string,
    actorId: string,
    projectId: string,
    dto: ReleaseOrderListQueryDto,
  ) {
    const result = await this.repository.list({
      teamId,
      projectId,
      query: dto.query?.trim() || undefined,
      status: dto.status,
      take: dto.take ?? 50,
    });
    return {
      scope: { actorId, teamId, projectId },
      ...result,
    };
  }
}
