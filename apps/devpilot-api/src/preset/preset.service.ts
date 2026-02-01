import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePresetDto, UpdatePresetDto } from './dto/preset.dto';

@Injectable()
export class PresetService {
  private readonly logger = new Logger(PresetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(teamId: string, userId: string, dto: CreatePresetDto) {
    // 检查名称是否重复
    const existing = await this.prisma.preset.findFirst({
      where: { teamId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException('预设名称已存在');
    }

    const preset = await this.prisma.preset.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        config: dto.config as object,
      },
    });

    this.logger.log(`Preset created: ${preset.id} (${dto.name})`);

    return {
      id: preset.id,
      name: preset.name,
      config: preset.config,
      createdAt: preset.createdAt,
    };
  }

  async findAll(teamId: string) {
    const presets = await this.prisma.preset.findMany({
      where: { teamId },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return presets.map((p) => ({
      id: p.id,
      name: p.name,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async findOne(teamId: string, id: string) {
    const preset = await this.prisma.preset.findFirst({
      where: { id, teamId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!preset) {
      throw new NotFoundException('预设不存在');
    }

    return {
      id: preset.id,
      name: preset.name,
      config: preset.config,
      createdBy: preset.createdBy,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    };
  }

  async update(teamId: string, id: string, dto: UpdatePresetDto) {
    const existing = await this.prisma.preset.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('预设不存在');
    }

    // 检查名称是否与其他预设重复
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.preset.findFirst({
        where: { teamId, name: dto.name, NOT: { id } },
      });

      if (duplicate) {
        throw new ConflictException('预设名称已存在');
      }
    }

    const preset = await this.prisma.preset.update({
      where: { id },
      data: {
        name: dto.name,
        config: dto.config as object,
      },
    });

    return {
      id: preset.id,
      name: preset.name,
      config: preset.config,
      updatedAt: preset.updatedAt,
    };
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.preset.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('预设不存在');
    }

    await this.prisma.preset.delete({ where: { id } });

    this.logger.log(`Preset deleted: ${id}`);

    return { success: true };
  }

  // 导出预设为 JSON
  async exportPreset(teamId: string, id: string) {
    const preset = await this.findOne(teamId, id);
    
    return {
      name: preset.name,
      config: preset.config,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
  }

  // 从 JSON 导入预设
  async importPreset(teamId: string, userId: string, data: { name: string; config: object }) {
    return this.create(teamId, userId, {
      name: data.name,
      config: data.config,
    });
  }
}
