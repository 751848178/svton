import { Injectable, NotFoundException } from "@nestjs/common";
import { ReleaseOrderDetailRepository } from "./release-order-detail.repository";
import { presentReleaseOrderDetail } from "./release-order-detail.presenter";
import { ReleaseOrderWithdrawRepository } from "./release-order-withdraw.repository";

@Injectable()
export class ReleaseOrderWithdrawService {
  constructor(
    private readonly repository: ReleaseOrderWithdrawRepository,
    private readonly details: ReleaseOrderDetailRepository,
  ) {}

  async withdraw(input: {
    teamId: string;
    actorId: string;
    projectId: string;
    releaseOrderId: string;
  }) {
    const outcome = await this.repository.withdraw(input);
    if (!outcome) {
      throw new NotFoundException("发布单不存在或不属于当前项目");
    }
    const detail = await this.details.find(
      input.teamId,
      input.projectId,
      input.releaseOrderId,
    );
    if (!detail) {
      throw new NotFoundException("发布单不存在或不属于当前项目");
    }
    return presentReleaseOrderDetail(detail);
  }
}
