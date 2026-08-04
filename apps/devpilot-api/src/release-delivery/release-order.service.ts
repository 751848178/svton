import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateReleaseOrderDto } from "./dto/release-order.dto";
import { isStoredConnectionAligned } from "../repository-identity/repository-identity-policy.utils";
import { ReleaseOrderRepository } from "./release-order.repository";

@Injectable()
export class ReleaseOrderService {
  constructor(private readonly repository: ReleaseOrderRepository) {}

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

  async get(teamId: string, projectId: string, releaseOrderId: string) {
    await this.assertProject(teamId, projectId);
    const order = await this.repository.findScoped(
      teamId,
      projectId,
      releaseOrderId,
    );
    if (!order) throw new NotFoundException("发布单不存在或不属于当前项目");
    return presentDetail(order);
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

interface ReleaseOrderDetailRecord extends ReleaseOrderRecord {
  project: {
    repositoryConnection: {
      repositoryUrl: string;
      provider: string;
      status: string;
      defaultBranch: string | null;
      selectedBranch: string | null;
    } | null;
    repositoryIdentity: {
      id: string;
      projectId: string;
      provider: string;
      canonicalKey: string;
      canonicalUrl: string;
      lockedAt: Date | null;
      currentRevision: {
        id: string;
        revision: number;
        defaultBranch: string;
        reason: string;
        createdAt: Date;
        identityId: string;
        projectId: string;
      } | null;
    } | null;
    environments: Array<{ id: string; baselineRole: string | null }>;
  };
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

function presentDetail(order: ReleaseOrderDetailRecord) {
  const base = present(order);
  const baselineRoles = new Set(
    order.project.environments.map((environment) => environment.baselineRole),
  );
  const repositoryReady = isStoredConnectionAligned(
    order.project.repositoryIdentity,
    order.project.repositoryConnection,
  );
  return {
    ...base,
    resumeStep:
      order._count.releaseRuns > 0
        ? "production"
        : order._count.buildRuns > 0
          ? "build"
          : "preflight",
    preflight: {
      ready:
        repositoryReady &&
        baselineRoles.has("staging") &&
        baselineRoles.has("production"),
      repository: {
        ready: repositoryReady,
        branch:
          order.project.repositoryIdentity?.currentRevision?.defaultBranch ||
          null,
        identityRevisionId:
          order.project.repositoryIdentity?.currentRevision?.id || null,
        identityRevision:
          order.project.repositoryIdentity?.currentRevision?.revision || null,
      },
      staging: { ready: baselineRoles.has("staging") },
      production: { ready: baselineRoles.has("production") },
    },
  };
}
