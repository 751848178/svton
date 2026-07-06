import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';

@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  // 加密配置
  private encrypt(text: string): string {
    return this.cryptoService.encryptGcm(text);
  }

  // 解密配置
  private decrypt(encryptedText: string): string {
    return this.cryptoService.decryptGcm(encryptedText);
  }

  // 创建资源（需要 teamId）
  async create(teamId: string, userId: string, dto: CreateResourceDto) {
    const encryptedConfig = this.encrypt(JSON.stringify(dto.config));

    const resource = await this.prisma.resource.create({
      data: {
        teamId,
        createdById: userId,
        type: dto.type,
        name: dto.name,
        config: encryptedConfig,
      },
    });

    this.logger.log(`Resource created: ${resource.id} (${dto.type})`);

    return {
      id: resource.id,
      type: resource.type,
      name: resource.name,
      createdAt: resource.createdAt,
    };
  }

  // 获取团队所有资源
  async findAll(teamId: string) {
    const resources = await this.prisma.resource.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });

    return resources.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  // 按类型获取资源
  async findByType(teamId: string, type: string) {
    const resources = await this.prisma.resource.findMany({
      where: { teamId, type },
      orderBy: { createdAt: 'desc' },
    });

    return resources.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      createdAt: r.createdAt,
    }));
  }

  // 获取单个资源
  async findOne(teamId: string, id: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, teamId },
    });

    if (!resource) {
      throw new NotFoundException('资源不存在');
    }

    // 解密配置但脱敏敏感字段
    const config = JSON.parse(this.decrypt(resource.config));
    const maskedConfig = this.maskSensitiveFields(config);

    return {
      id: resource.id,
      type: resource.type,
      name: resource.name,
      config: maskedConfig,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }

  // 获取解密后的配置
  async getDecryptedConfig(teamId: string, id: string): Promise<Record<string, string>> {
    const resource = await this.prisma.resource.findFirst({
      where: { id, teamId },
    });

    if (!resource) {
      throw new NotFoundException('资源不存在');
    }

    return JSON.parse(this.decrypt(resource.config));
  }

  async getCredentialForGeneration(teamId: string, id: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, teamId },
    });

    if (!resource) {
      throw new NotFoundException('资源不存在');
    }

    return {
      id: resource.id,
      type: resource.type,
      name: resource.name,
      config: JSON.parse(this.decrypt(resource.config)) as Record<string, string>,
    };
  }

  // 更新资源
  async update(teamId: string, id: string, dto: UpdateResourceDto) {
    const existing = await this.prisma.resource.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('资源不存在');
    }

    const updateData: { name?: string; config?: string } = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.config) {
      updateData.config = this.encrypt(JSON.stringify(dto.config));
    }

    const resource = await this.prisma.resource.update({
      where: { id },
      data: updateData,
    });

    return {
      id: resource.id,
      type: resource.type,
      name: resource.name,
      updatedAt: resource.updatedAt,
    };
  }

  // 删除资源
  async remove(teamId: string, id: string) {
    const existing = await this.prisma.resource.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('资源不存在');
    }

    await this.prisma.resource.delete({ where: { id } });

    this.logger.log(`Resource deleted: ${id}`);

    return { success: true };
  }

  // 脱敏敏感字段
  private maskSensitiveFields(config: Record<string, string>): Record<string, string> {
    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'accessKey', 'secretKey'];
    const masked: Record<string, string> = {};

    for (const [key, value] of Object.entries(config)) {
      const isSensitive = sensitiveKeys.some((sk) => 
        key.toLowerCase().includes(sk.toLowerCase())
      );

      if (isSensitive && typeof value === 'string' && value.length > 0) {
        masked[key] = value.slice(0, 3) + '***' + value.slice(-3);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}
