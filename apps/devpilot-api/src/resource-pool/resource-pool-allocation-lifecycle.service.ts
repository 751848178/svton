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

/** Sentinel thrown by the repository when the atomic capacity check fails. */
const RESOURCE_POOL_FULL = "RESOURCE_POOL_FULL";

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
    let allocation;
    try {
      allocation = await this.repository.createAllocationAndIncrementPool({
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
    } catch (error) {
      // M1: if the allocation record can't be persisted, roll back the
      // already-created real DB/user (or Redis marker) so it isn't orphaned.
      // Pass the in-memory credentials so a redis slot is deprovisioned against
      // the correct `db` (it was never persisted, so we can't read it back).
      await this.compensateProvisionFailure(
        pool,
        resourceName,
        credentials,
        error,
      );
      // M2: the transaction rejects over-allocation with a sentinel; surface it
      // as a 400 instead of letting a concurrent request 500.
      if (isPoolFullRace(error)) {
        throw new BadRequestException("Resource pool is full");
      }
      throw error;
    }

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
      // H1: decrypt the allocation credentials so deprovision targets the
      // originally-allocated Redis DB (1..15) instead of defaulting to DB 0.
      this.readAllocationCredentials(allocation.credentials),
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

  /**
   * Best-effort compensating deprovision when persisting the allocation fails
   * after the real resource was created. Logs but never swallows the original
   * error; a deprovision failure is logged alongside it rather than masked.
   */
  private async compensateProvisionFailure(
    pool: { type: string; endpoint?: string; adminConfig: string },
    resourceName: string,
    credentials: Record<string, unknown>,
    originalError: unknown,
  ): Promise<void> {
    try {
      await this.provisioningService.deprovisionResource(
        pool,
        resourceName,
        credentials,
      );
    } catch (deprovisionError) {
      this.logger.error(
        `Compensating deprovision failed for ${resourceName} after allocation ` +
          `write failure; the resource may be orphaned. Original error follows.`,
        deprovisionError instanceof Error ? deprovisionError.stack : String(deprovisionError),
      );
      this.logger.error(
        `Original allocation write error for ${resourceName}.`,
        originalError instanceof Error ? originalError.stack : String(originalError),
      );
    }
  }

  private readAllocationCredentials(
    encrypted: string | undefined | null,
  ): Record<string, unknown> | undefined {
    if (!encrypted) return undefined;
    try {
      return JSON.parse(
        this.cryptoService.decryptCbc(encrypted),
      ) as Record<string, unknown>;
    } catch {
      this.logger.warn(
        "Could not decrypt allocation credentials for deprovision; redis DB index will be unavailable.",
      );
      return undefined;
    }
  }
}

function isPoolFullRace(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes(RESOURCE_POOL_FULL)
  );
}
