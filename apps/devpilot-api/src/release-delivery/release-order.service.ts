import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateReleaseOrderDto } from "./dto/release-order.dto";
import { ReleaseOrderDetailRepository } from "./release-order-detail.repository";
import { presentReleaseOrderDetail } from "./release-order-detail.presenter";
import { ReleaseOrderRepository } from "./release-order.repository";

@Injectable()
export class ReleaseOrderService {
  constructor(
    private readonly repository: ReleaseOrderRepository,
    private readonly details: ReleaseOrderDetailRepository,
  ) {}

  async create(
    teamId: string,
    actorId: string,
    projectId: string,
    dto: CreateReleaseOrderDto,
  ) {
    await this.assertProject(teamId, projectId);
    const releaseVersion = dto.releaseVersion.trim();
    const note = normalizeNote(dto.note);
    const existing = await this.repository.findByVersion(
      projectId,
      releaseVersion,
    );
    if (existing) {
      return this.replayOrConflict(existing, note, teamId, projectId);
    }
    try {
      const created = await this.repository.create({
        teamId,
        actorId,
        projectId,
        releaseVersion,
        note,
      });
      return this.canonicalDetail(teamId, projectId, created.id);
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const concurrent = await this.repository.findByVersion(
        projectId,
        releaseVersion,
      );
      if (!concurrent) throw error;
      return this.replayOrConflict(concurrent, note, teamId, projectId);
    }
  }

  async get(teamId: string, projectId: string, releaseOrderId: string) {
    await this.assertProject(teamId, projectId);
    return this.canonicalDetail(teamId, projectId, releaseOrderId);
  }

  private async assertProject(teamId: string, projectId: string) {
    if (!(await this.repository.findProject(teamId, projectId))) {
      throw new NotFoundException("项目不存在或不属于当前团队");
    }
  }

  private replayOrConflict(
    existing: { id: string; note: string | null },
    note: string | null,
    teamId: string,
    projectId: string,
  ) {
    if (existing.note === note) {
      return this.canonicalDetail(teamId, projectId, existing.id);
    }
    throw new ConflictException("该发布版本号已存在，且说明与原请求不一致");
  }

  private async canonicalDetail(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
  ) {
    const detail = await this.details.find(teamId, projectId, releaseOrderId);
    if (!detail) throw new NotFoundException("发布单不存在或不属于当前项目");
    return presentReleaseOrderDetail(detail);
  }
}

function normalizeNote(note?: string) {
  return note?.trim() || null;
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
