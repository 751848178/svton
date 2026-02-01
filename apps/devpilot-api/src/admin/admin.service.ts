import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 获取所有用户
  async getUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              createdProjects: true,
              createdPresets: true,
              createdResources: true,
              teamMembers: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 更新用户角色
  async updateUserRole(userId: string, role: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    this.logger.log(`User role updated: ${userId} -> ${role}`);

    return user;
  }

  // 获取系统统计
  async getStats() {
    const [userCount, projectCount, presetCount, resourceCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.project.count(),
      this.prisma.preset.count(),
      this.prisma.resource.count(),
    ]);

    return {
      users: userCount,
      projects: projectCount,
      presets: presetCount,
      resources: resourceCount,
    };
  }

  // 获取资源池列表
  async getResourcePools() {
    return this.prisma.resourcePool.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { allocations: true },
        },
      },
    });
  }

  // 创建资源池
  async createResourcePool(data: {
    type: string;
    name: string;
    endpoint: string;
    adminConfig: string;
    capacity: number;
  }) {
    const pool = await this.prisma.resourcePool.create({
      data: {
        ...data,
        status: 'active',
      },
    });

    this.logger.log(`Resource pool created: ${pool.id} (${data.type})`);

    return pool;
  }

  // 更新资源池状态
  async updateResourcePoolStatus(poolId: string, status: string) {
    const pool = await this.prisma.resourcePool.update({
      where: { id: poolId },
      data: { status },
    });

    this.logger.log(`Resource pool status updated: ${poolId} -> ${status}`);

    return pool;
  }
}
