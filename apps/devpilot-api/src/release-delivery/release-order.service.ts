import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateReleaseOrderDto } from "./dto/release-order.dto";
import { ReleaseOrderRepository } from "./release-order.repository";

@Injectable()
export class ReleaseOrderService {
  constructor(private readonly repository: ReleaseOrderRepository) {}

  async list(teamId: string, projectId: string) {
    await this.assertProject(teamId, projectId);
    const items = await this.repository.list(teamId, projectId);
    return { items: items.map(present), total: items.length };
  }

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
    if (existing) return this.replayOrConflict(existing, note);
    try {
      return present(
        await this.repository.create({
          teamId,
          actorId,
          projectId,
          releaseVersion,
          note,
        }),
      );
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const concurrent = await this.repository.findByVersion(
        projectId,
        releaseVersion,
      );
      if (!concurrent) throw error;
      return this.replayOrConflict(concurrent, note);
    }
  }

  private async assertProject(teamId: string, projectId: string) {
    if (!(await this.repository.findProject(teamId, projectId))) {
      throw new NotFoundException("项目不存在或不属于当前团队");
    }
  }

  private replayOrConflict(existing: ReleaseOrderRecord, note: string | null) {
    if (existing.note === note) return present(existing);
    throw new ConflictException("该发布版本号已存在，且说明与原请求不一致");
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

interface ReleaseOrderRecord {
  id: string;
  projectId: string;
  releaseVersion: string;
  note: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { buildRuns: number; manifests: number; releaseRuns: number };
}

function present(order: ReleaseOrderRecord) {
  return {
    id: order.id,
    projectId: order.projectId,
    releaseVersion: order.releaseVersion,
    note: order.note,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    counts: order._count,
  };
}
