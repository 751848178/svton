import { Injectable, NotFoundException } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import { AllocateResourceDto } from "./dto/resource-pool.dto";
import { ResourcePoolRepository } from "./resource-pool.repository";

export type ResourcePoolAuthRequest = {
  user: { id: string };
  teamId: string;
};

type ReadableResourcePool = { id: string };
type ResourcePoolScope = {
  projectId?: string | null;
  environmentId?: string | null;
};

@Injectable()
export class ResourcePoolAccessService {
  constructor(
    private readonly accessPolicyService: ControlAccessPolicyService,
    private readonly repository: ResourcePoolRepository,
  ) {}

  async resolveAllocationInputAccessScope(
    teamId: string,
    dto: AllocateResourceDto,
  ) {
    const project = await this.repository.findProjectScope(
      teamId,
      dto.projectId,
    );

    if (!project) {
      throw new NotFoundException("项目不存在或不属于当前团队");
    }

    return {
      projectId: project.id,
      environmentId: null,
    };
  }

  async getAllocationAccessScope(teamId: string, allocationId: string) {
    const allocation = await this.repository.findAllocationScope(
      teamId,
      allocationId,
    );

    if (!allocation) {
      throw new NotFoundException("Allocation not found");
    }

    return {
      projectId: allocation.projectId,
      environmentId: null,
    };
  }

  async filterReadablePools<T extends ReadableResourcePool>(
    req: ResourcePoolAuthRequest,
    pools: T[],
  ) {
    const readablePools = await Promise.all(
      pools.map(async (pool) => ({
        pool,
        allowed: await this.accessPolicyService.canRead({
          ...this.baseInput(req),
          category: "resource_pool",
          action: "resource_pool.read",
          targetType: "resource_pool",
          targetId: pool.id,
          risk: "low",
        }),
      })),
    );

    return readablePools
      .filter((item) => item.allowed)
      .map((item) => item.pool);
  }

  assertCanReadPool(req: ResourcePoolAuthRequest, poolId: string) {
    return this.accessPolicyService.assertCanRead({
      ...this.baseInput(req),
      category: "resource_pool",
      action: "resource_pool.read",
      targetType: "resource_pool",
      targetId: poolId,
      risk: "low",
    });
  }

  assertCanReadProjectAllocations(
    req: ResourcePoolAuthRequest,
    projectId: string,
  ) {
    return this.accessPolicyService.assertCanRead({
      ...this.baseInput(req),
      projectId,
      category: "resource_pool",
      action: "resource_allocation.read",
      targetType: "resource_allocation",
      targetId: projectId,
      risk: "low",
    });
  }

  assertCanAllocate(
    req: ResourcePoolAuthRequest,
    dto: AllocateResourceDto,
    scope: ResourcePoolScope,
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      ...this.baseInput(req),
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: "resource_pool",
      action: "resource_pool.allocate",
      targetType: "resource_pool",
      targetId: dto.poolId,
      risk: "medium",
    });
  }

  assertCanRelease(
    req: ResourcePoolAuthRequest,
    allocationId: string,
    scope: ResourcePoolScope,
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      ...this.baseInput(req),
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: "resource_pool",
      action: "resource_pool.release",
      targetType: "resource_allocation",
      targetId: allocationId,
      risk: "high",
    });
  }

  private baseInput(req: ResourcePoolAuthRequest) {
    return {
      teamId: req.teamId,
      actorId: req.user.id,
    };
  }
}
