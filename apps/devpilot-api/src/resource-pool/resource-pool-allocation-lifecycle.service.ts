import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CryptoService } from "../common/crypto/crypto.service";
import { AllocateResourceDto, PoolStatus } from "./dto/resource-pool.dto";
import { ResourcePoolProvisioningService } from "./resource-pool-provisioning.service";
import { ResourcePoolRepository } from "./resource-pool.repository";

@Injectable()
export class ResourcePoolAllocationLifecycleService {
  private readonly logger = new Logger(
    ResourcePoolAllocationLifecycleService.name,
  );

  constructor(
    private readonly repository: ResourcePoolRepository,
    private readonly cryptoService: CryptoService,
    private readonly provisioningService: ResourcePoolProvisioningService,
  ) {}

  async allocateResource(
    dto: AllocateResourceDto,
    userId: string,
    teamId: string,
  ) {
    const pool = await this.repository.findPoolForAllocation(dto.poolId);

    if (!pool) {
      throw new NotFoundException("Resource pool not found");
    }

    if (pool.status !== PoolStatus.ACTIVE) {
      throw new BadRequestException("Resource pool is not active");
    }

    if (pool.allocated >= pool.capacity) {
      throw new BadRequestException("Resource pool is full");
    }

    const resourceName =
      dto.resourceName ||
      this.provisioningService.generateResourceName(pool.type, dto.projectId);
    const credentials = await this.provisioningService.provisionResource(
      pool,
      resourceName,
    );

    const nextPoolStatus =
      pool.allocated + 1 >= pool.capacity ? PoolStatus.FULL : pool.status;
    const allocation = await this.repository.createAllocationAndIncrementPool({
      pool,
      projectId: dto.projectId,
      teamId,
      userId,
      resourceName,
      encryptedCredentials: this.cryptoService.encryptCbc(
        JSON.stringify(credentials),
      ),
      nextPoolStatus,
    });

    this.logger.log(
      `Allocated resource ${resourceName} from pool ${pool.name}`,
    );

    return {
      id: allocation.id,
      type: pool.type,
      resourceName: allocation.resourceName,
      credentials,
    };
  }

  async releaseResource(teamId: string, allocationId: string) {
    const allocation = await this.repository.findAllocationForRelease(
      teamId,
      allocationId,
    );

    if (!allocation) {
      throw new NotFoundException("Allocation not found");
    }

    if (allocation.status !== "active") {
      throw new BadRequestException("Resource already released");
    }

    await this.provisioningService.deprovisionResource(
      allocation.pool,
      allocation.resourceName,
    );

    const nextPoolStatus =
      allocation.pool.status === PoolStatus.FULL
        ? PoolStatus.ACTIVE
        : allocation.pool.status;
    await this.repository.releaseAllocationAndDecrementPool({
      allocation,
      nextPoolStatus,
    });

    this.logger.log(`Released resource ${allocation.resourceName}`);
    return { success: true };
  }
}
