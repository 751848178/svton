import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { CryptoService } from "../common/crypto/crypto.service";
import {
  CreateResourcePoolDto,
  UpdateResourcePoolDto,
  AllocateResourceDto,
  PoolStatus,
} from "./dto/resource-pool.dto";
import {
  formatPoolAllocationSummary,
  formatPoolResponse,
  formatProjectAllocation,
  formatUserAllocation,
} from "./resource-pool-response.utils";
import {
  ResourceAllocationRecord,
  ResourcePoolRecord,
} from "./resource-pool.types";
import { ResourcePoolAllocationLifecycleService } from "./resource-pool-allocation-lifecycle.service";
import { ResourcePoolRepository } from "./resource-pool.repository";

@Injectable()
export class ResourcePoolService {
  private readonly logger = new Logger(ResourcePoolService.name);

  constructor(
    private readonly repository: ResourcePoolRepository,
    private readonly cryptoService: CryptoService,
    private readonly allocationLifecycleService: ResourcePoolAllocationLifecycleService,
  ) {}

  // 加密凭证
  private encrypt(text: string): string {
    return this.cryptoService.encryptCbc(text);
  }

  // 创建资源池
  async createPool(dto: CreateResourcePoolDto) {
    const encryptedConfig = this.encrypt(JSON.stringify(dto.adminConfig));

    const pool = await this.repository.createPool({
      type: dto.type,
      name: dto.name,
      endpoint: dto.endpoint,
      adminConfig: encryptedConfig,
      capacity: dto.capacity,
      allocated: 0,
      status: PoolStatus.ACTIVE,
    });

    this.logger.log(`Created resource pool: ${pool.name} (${pool.type})`);
    return formatPoolResponse(pool);
  }

  // 获取所有资源池
  async getPools(type?: string) {
    const pools = await this.repository.findPools(type);

    return pools.map((pool: ResourcePoolRecord) => formatPoolResponse(pool));
  }

  async getAvailablePools(type?: string) {
    const pools = await this.repository.findActivePools(type);

    return pools
      .filter((pool: ResourcePoolRecord) => pool.allocated < pool.capacity)
      .map((pool: ResourcePoolRecord) => formatPoolResponse(pool));
  }

  // 获取资源池详情
  async getPool(id: string) {
    const pool = await this.repository.findPoolDetail(id);

    if (!pool) {
      throw new NotFoundException("Resource pool not found");
    }

    return {
      ...formatPoolResponse(pool),
      allocations: pool.allocations.map(
        (allocation: ResourceAllocationRecord) =>
          formatPoolAllocationSummary(allocation),
      ),
    };
  }

  // 更新资源池
  async updatePool(id: string, dto: UpdateResourcePoolDto) {
    const updateData: Record<string, unknown> = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.endpoint) updateData.endpoint = dto.endpoint;
    if (dto.capacity) updateData.capacity = dto.capacity;
    if (dto.status) updateData.status = dto.status;
    if (dto.adminConfig) {
      updateData.adminConfig = this.encrypt(JSON.stringify(dto.adminConfig));
    }

    const pool = await this.repository.updatePool(id, updateData);

    return formatPoolResponse(pool);
  }

  // 删除资源池
  async deletePool(id: string) {
    const pool = await this.repository.findPoolForDelete(id);

    if (!pool) {
      throw new NotFoundException("Resource pool not found");
    }

    if (pool.allocations.length > 0) {
      throw new BadRequestException(
        "Cannot delete pool with active allocations",
      );
    }

    await this.repository.deletePool(id);
    return { success: true };
  }

  // 分配资源
  async allocateResource(
    dto: AllocateResourceDto,
    userId: string,
    teamId: string,
  ) {
    return this.allocationLifecycleService.allocateResource(
      dto,
      userId,
      teamId,
    );
  }

  // 释放资源
  async releaseResource(teamId: string, allocationId: string) {
    return this.allocationLifecycleService.releaseResource(
      teamId,
      allocationId,
    );
  }

  // 获取项目的资源分配
  async getProjectAllocations(teamId: string, projectId: string) {
    const allocations = await this.repository.findProjectAllocations(
      teamId,
      projectId,
    );

    return allocations.map((allocation: ResourceAllocationRecord) =>
      formatProjectAllocation(allocation),
    );
  }

  // 获取用户的资源分配
  async getUserAllocations(teamId: string, userId: string) {
    const allocations = await this.repository.findUserAllocations(
      teamId,
      userId,
    );

    return allocations.map((allocation: ResourceAllocationRecord) =>
      formatUserAllocation(allocation),
    );
  }
}
