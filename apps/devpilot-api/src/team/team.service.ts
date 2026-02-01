import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto, MemberRole } from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  // 创建团队
  async create(userId: string, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description,
        members: {
          create: {
            userId,
            role: MemberRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    return team;
  }

  // 获取用户的所有团队
  async findByUser(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: {
              select: { members: true, projects: true },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      description: m.team.description,
      role: m.role,
      memberCount: m.team._count.members,
      projectCount: m.team._count.projects,
      createdAt: m.team.createdAt,
    }));
  }

  // 获取团队详情
  async findOne(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('无权访问该团队');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
        _count: {
          select: {
            projects: true,
            servers: true,
            proxyConfigs: true,
            cdnConfigs: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('团队不存在');
    }

    return {
      ...team,
      currentUserRole: membership.role,
    };
  }

  // 更新团队
  async update(teamId: string, userId: string, dto: UpdateTeamDto) {
    await this.checkPermission(teamId, userId, [MemberRole.OWNER, MemberRole.ADMIN]);

    return this.prisma.team.update({
      where: { id: teamId },
      data: dto,
    });
  }

  // 删除团队
  async remove(teamId: string, userId: string) {
    await this.checkPermission(teamId, userId, [MemberRole.OWNER]);

    await this.prisma.team.delete({
      where: { id: teamId },
    });

    return { success: true };
  }

  // 添加成员
  async addMember(teamId: string, userId: string, email: string, role: MemberRole) {
    await this.checkPermission(teamId, userId, [MemberRole.OWNER, MemberRole.ADMIN]);

    // 查找用户
    const targetUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      throw new NotFoundException('用户不存在');
    }

    // 检查是否已是成员
    const existing = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: targetUser.id },
      },
    });

    if (existing) {
      throw new BadRequestException('该用户已是团队成员');
    }

    // 不能添加 owner（只能有一个 owner）
    if (role === MemberRole.OWNER) {
      throw new BadRequestException('不能添加 owner 角色');
    }

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: targetUser.id,
        role,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  // 移除成员
  async removeMember(teamId: string, userId: string, memberId: string) {
    await this.checkPermission(teamId, userId, [MemberRole.OWNER, MemberRole.ADMIN]);

    const member = await this.prisma.teamMember.findFirst({
      where: { teamId, userId: memberId },
    });

    if (!member) {
      throw new NotFoundException('成员不存在');
    }

    // 不能移除 owner
    if (member.role === MemberRole.OWNER) {
      throw new BadRequestException('不能移除团队所有者');
    }

    // admin 不能移除其他 admin
    const currentMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (currentMember?.role === MemberRole.ADMIN && member.role === MemberRole.ADMIN) {
      throw new ForbiddenException('管理员不能移除其他管理员');
    }

    await this.prisma.teamMember.delete({
      where: { id: member.id },
    });

    return { success: true };
  }

  // 更新成员角色
  async updateMemberRole(teamId: string, userId: string, memberId: string, role: MemberRole) {
    await this.checkPermission(teamId, userId, [MemberRole.OWNER]);

    const member = await this.prisma.teamMember.findFirst({
      where: { teamId, userId: memberId },
    });

    if (!member) {
      throw new NotFoundException('成员不存在');
    }

    // 不能更改 owner 的角色
    if (member.role === MemberRole.OWNER) {
      throw new BadRequestException('不能更改团队所有者的角色');
    }

    // 不能设置为 owner
    if (role === MemberRole.OWNER) {
      throw new BadRequestException('不能设置为 owner 角色');
    }

    return this.prisma.teamMember.update({
      where: { id: member.id },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  // 检查用户权限
  async checkPermission(teamId: string, userId: string, allowedRoles: MemberRole[]) {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('无权访问该团队');
    }

    if (!allowedRoles.includes(membership.role as MemberRole)) {
      throw new ForbiddenException('权限不足');
    }

    return membership;
  }

  // 检查用户是否是团队成员
  async isMember(teamId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    return !!membership;
  }

  // 获取用户在团队中的角色
  async getMemberRole(teamId: string, userId: string): Promise<string | null> {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    return membership?.role || null;
  }
}
