import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(teamId: string, userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        config: dto.config,
        gitRepo: dto.gitRepo,
      },
    });

    this.logger.log(`Project created: ${project.id} (${dto.name})`);

    return project;
  }

  async findAll(teamId: string) {
    const projects = await this.prisma.project.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            allocations: true,
            proxyConfigs: true,
            cdnConfigs: true,
            secretKeys: true,
          },
        },
      },
    });

    return projects;
  }

  async findOne(teamId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, teamId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        allocations: {
          include: {
            pool: {
              select: { id: true, name: true, type: true },
            },
          },
        },
        proxyConfigs: true,
        cdnConfigs: true,
        secretKeys: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  async update(teamId: string, id: string, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('项目不存在');
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        config: dto.config,
        gitRepo: dto.gitRepo,
      },
    });

    this.logger.log(`Project updated: ${id}`);

    return project;
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.project.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('项目不存在');
    }

    await this.prisma.project.delete({ where: { id } });

    this.logger.log(`Project deleted: ${id}`);

    return { success: true };
  }
}
