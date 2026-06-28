import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import {
  CreateResourcePoolDto,
  UpdateResourcePoolDto,
  AllocateResourceDto,
  PoolStatus,
} from './dto/resource-pool.dto';

interface ResourcePool {
  id: string;
  type: string;
  name: string;
  endpoint: string;
  adminConfig: string;
  capacity: number;
  allocated: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ResourceAllocation {
  id: string;
  poolId: string;
  projectId: string;
  teamId: string;
  userId: string;
  resourceName: string;
  credentials: string;
  config: unknown;
  status: string;
  createdAt: Date;
  releasedAt: Date | null;
  pool?: ResourcePool;
  project?: { name: string };
  user?: { name: string | null; email: string };
}

@Injectable()
export class ResourcePoolService {
  private readonly logger = new Logger(ResourcePoolService.name);
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!';

  constructor(private readonly prisma: PrismaService) {}

  // 加密凭证
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // 解密凭证
  private decrypt(text: string): string {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // 创建资源池
  async createPool(dto: CreateResourcePoolDto) {
    const encryptedConfig = this.encrypt(JSON.stringify(dto.adminConfig));

    const pool = await (this.prisma as any).resourcePool.create({
      data: {
        type: dto.type,
        name: dto.name,
        endpoint: dto.endpoint,
        adminConfig: encryptedConfig,
        capacity: dto.capacity,
        allocated: 0,
        status: PoolStatus.ACTIVE,
      },
    });

    this.logger.log(`Created resource pool: ${pool.name} (${pool.type})`);
    return this.formatPoolResponse(pool);
  }

  // 获取所有资源池
  async getPools(type?: string) {
    const pools = await (this.prisma as any).resourcePool.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return pools.map((pool: ResourcePool) => this.formatPoolResponse(pool));
  }

  async getAvailablePools(type?: string) {
    const pools = await (this.prisma as any).resourcePool.findMany({
      where: {
        ...(type ? { type } : {}),
        status: PoolStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    return pools
      .filter((pool: ResourcePool) => pool.allocated < pool.capacity)
      .map((pool: ResourcePool) => this.formatPoolResponse(pool));
  }

  // 获取资源池详情
  async getPool(id: string) {
    const pool = await (this.prisma as any).resourcePool.findUnique({
      where: { id },
      include: {
        allocations: {
          where: { status: 'active' },
          include: { project: true, user: true },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Resource pool not found');
    }

    return {
      ...this.formatPoolResponse(pool),
      allocations: pool.allocations.map((a: ResourceAllocation) => ({
        id: a.id,
        resourceName: a.resourceName,
        projectName: a.project?.name,
        userName: a.user?.name || a.user?.email,
        createdAt: a.createdAt,
      })),
    };
  }

  async resolveAllocationInputAccessScope(teamId: string, dto: AllocateResourceDto) {
    const project = await (this.prisma as any).project.findFirst({
      where: { id: dto.projectId, teamId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或不属于当前团队');
    }

    return {
      projectId: project.id,
      environmentId: null,
    };
  }

  async getAllocationAccessScope(teamId: string, allocationId: string) {
    const allocation = await (this.prisma as any).resourceAllocation.findFirst({
      where: { id: allocationId, teamId },
      select: { id: true, projectId: true },
    });

    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }

    return {
      projectId: allocation.projectId,
      environmentId: null,
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

    const pool = await (this.prisma as any).resourcePool.update({
      where: { id },
      data: updateData,
    });

    return this.formatPoolResponse(pool);
  }

  // 删除资源池
  async deletePool(id: string) {
    const pool = await (this.prisma as any).resourcePool.findUnique({
      where: { id },
      include: { allocations: { where: { status: 'active' } } },
    });

    if (!pool) {
      throw new NotFoundException('Resource pool not found');
    }

    if (pool.allocations.length > 0) {
      throw new BadRequestException('Cannot delete pool with active allocations');
    }

    await (this.prisma as any).resourcePool.delete({ where: { id } });
    return { success: true };
  }

  // 分配资源
  async allocateResource(dto: AllocateResourceDto, userId: string, teamId: string) {
    const pool = await (this.prisma as any).resourcePool.findUnique({
      where: { id: dto.poolId },
    });

    if (!pool) {
      throw new NotFoundException('Resource pool not found');
    }

    if (pool.status !== PoolStatus.ACTIVE) {
      throw new BadRequestException('Resource pool is not active');
    }

    if (pool.allocated >= pool.capacity) {
      throw new BadRequestException('Resource pool is full');
    }

    // 生成资源名称
    const resourceName = dto.resourceName || this.generateResourceName(pool.type, dto.projectId);

    // 生成凭证
    const credentials = await this.provisionResource(pool, resourceName);

    // 创建分配记录
    const allocation = await (this.prisma as any).$transaction(async (tx: any) => {
      // 更新池的已分配数量
      await tx.resourcePool.update({
        where: { id: pool.id },
        data: {
          allocated: { increment: 1 },
          status: pool.allocated + 1 >= pool.capacity ? PoolStatus.FULL : pool.status,
        },
      });

      // 创建分配记录
      return tx.resourceAllocation.create({
        data: {
          poolId: pool.id,
          projectId: dto.projectId,
          teamId,
          userId,
          resourceName,
          credentials: this.encrypt(JSON.stringify(credentials)),
          config: {},
          status: 'active',
        },
      });
    });

    this.logger.log(`Allocated resource ${resourceName} from pool ${pool.name}`);

    return {
      id: allocation.id,
      type: pool.type,
      resourceName: allocation.resourceName,
      credentials,
    };
  }

  // 释放资源
  async releaseResource(teamId: string, allocationId: string) {
    const allocation = await (this.prisma as any).resourceAllocation.findFirst({
      where: { id: allocationId, teamId },
      include: { pool: true },
    });

    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }

    if (allocation.status !== 'active') {
      throw new BadRequestException('Resource already released');
    }

    // 清理资源
    await this.deprovisionResource(allocation.pool, allocation.resourceName);

    // 更新记录
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.resourceAllocation.update({
        where: { id: allocationId },
        data: {
          status: 'released',
          releasedAt: new Date(),
        },
      });

      await tx.resourcePool.update({
        where: { id: allocation.poolId },
        data: {
          allocated: { decrement: 1 },
          status: allocation.pool.status === PoolStatus.FULL ? PoolStatus.ACTIVE : allocation.pool.status,
        },
      });
    });

    this.logger.log(`Released resource ${allocation.resourceName}`);
    return { success: true };
  }

  // 获取项目的资源分配
  async getProjectAllocations(teamId: string, projectId: string) {
    const allocations = await (this.prisma as any).resourceAllocation.findMany({
      where: { teamId, projectId, status: 'active' },
      include: { pool: true },
    });

    return allocations.map((a: ResourceAllocation) => ({
      id: a.id,
      poolType: a.pool?.type,
      poolName: a.pool?.name,
      resourceName: a.resourceName,
      createdAt: a.createdAt,
    }));
  }

  // 获取用户的资源分配
  async getUserAllocations(userId: string) {
    const allocations = await (this.prisma as any).resourceAllocation.findMany({
      where: { userId },
      include: { pool: true, project: true },
      orderBy: { createdAt: 'desc' },
    });

    return allocations.map((a: ResourceAllocation) => ({
      id: a.id,
      poolType: a.pool?.type,
      poolName: a.pool?.name,
      resourceName: a.resourceName,
      projectName: a.project?.name,
      status: a.status,
      createdAt: a.createdAt,
      releasedAt: a.releasedAt,
    }));
  }

  // 生成资源名称
  private generateResourceName(type: string, projectId: string): string {
    const suffix = projectId.slice(-6);
    switch (type) {
      case 'mysql':
        return `db_${suffix}`;
      case 'redis':
        return `redis_${suffix}`;
      default:
        return `res_${suffix}`;
    }
  }

  // 开通资源（实际实现需要连接到资源服务器）
  private async provisionResource(
    pool: { type: string; endpoint: string; adminConfig: string },
    resourceName: string,
  ) {
    const adminConfig = JSON.parse(this.decrypt(pool.adminConfig)) as Record<string, unknown>;

    switch (pool.type) {
      case 'mysql': {
        // 实际实现：连接 MySQL 创建数据库和用户
        const mysqlEndpoint = this.parseEndpoint(pool.endpoint, 3306);
        return {
          host: mysqlEndpoint.host,
          port: mysqlEndpoint.port,
          database: resourceName,
          username: `user_${resourceName}`,
          password: crypto.randomBytes(16).toString('hex'),
        };
      }
      case 'postgresql': {
        // 实际实现：连接 PostgreSQL 创建数据库和用户
        const postgresqlEndpoint = this.parseEndpoint(pool.endpoint, 5432);
        return {
          host: postgresqlEndpoint.host,
          port: postgresqlEndpoint.port,
          database: resourceName,
          schema: 'public',
          username: `user_${resourceName}`,
          password: crypto.randomBytes(16).toString('hex'),
        };
      }
      case 'redis': {
        // 实际实现：分配 Redis DB 或 key prefix
        const redisEndpoint = this.parseEndpoint(pool.endpoint, 6379);
        return {
          host: redisEndpoint.host,
          port: redisEndpoint.port,
          db: Math.floor(Math.random() * 15) + 1,
          password: typeof adminConfig.password === 'string' ? adminConfig.password : '',
          keyPrefix: `${resourceName}:`,
        };
      }
      default:
        return { resourceName };
    }
  }

  // 清理资源
  private async deprovisionResource(pool: { type: string; adminConfig: string }, resourceName: string) {
    // 实际实现：连接到资源服务器删除资源
    this.logger.log(`Deprovisioning ${pool.type} resource: ${resourceName}`);
  }

  private parseEndpoint(endpoint: string, defaultPort: number) {
    try {
      const normalized = endpoint.includes('://') ? endpoint : `tcp://${endpoint}`;
      const url = new URL(normalized);
      return {
        host: url.hostname || endpoint,
        port: url.port ? Number(url.port) : defaultPort,
      };
    } catch {
      const [host, port] = endpoint.split(':');
      return {
        host: host || endpoint,
        port: port ? Number(port) : defaultPort,
      };
    }
  }

  private formatPoolResponse(pool: {
    id: string;
    type: string;
    name: string;
    endpoint: string;
    capacity: number;
    allocated: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: pool.id,
      type: pool.type,
      name: pool.name,
      endpoint: pool.endpoint,
      capacity: pool.capacity,
      allocated: pool.allocated,
      status: pool.status,
      available: pool.capacity - pool.allocated,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
    };
  }
}
