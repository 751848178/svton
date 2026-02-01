import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCDNConfigDto, UpdateCDNConfigDto, CreateCredentialDto } from './dto/cdn-config.dto';
import * as crypto from 'crypto';

@Injectable()
export class CDNConfigService {
  private readonly logger = new Logger(CDNConfigService.name);
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!';

  constructor(private readonly prisma: PrismaService) {}

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(text: string): string {
    const [ivHex, authTagHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // CDN 配置 CRUD
  async create(teamId: string, userId: string, dto: CreateCDNConfigDto) {
    const config = await this.prisma.cDNConfig.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        domain: dto.domain,
        origin: dto.origin,
        provider: dto.provider,
        credentialId: dto.credentialId,
        cacheRules: dto.cacheRules || [],
        projectId: dto.projectId,
        status: 'pending',
      },
      include: {
        credential: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`CDNConfig created: ${config.id} (${dto.domain})`);
    return config;
  }

  async findAll(teamId: string) {
    return this.prisma.cDNConfig.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        credential: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findOne(teamId: string, id: string) {
    const config = await this.prisma.cDNConfig.findFirst({
      where: { id, teamId },
      include: {
        credential: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!config) {
      throw new NotFoundException('CDN 配置不存在');
    }

    return config;
  }

  async update(teamId: string, id: string, dto: UpdateCDNConfigDto) {
    const existing = await this.prisma.cDNConfig.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('CDN 配置不存在');
    }

    const config = await this.prisma.cDNConfig.update({
      where: { id },
      data: {
        ...dto,
        status: 'pending',
      },
      include: {
        credential: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`CDNConfig updated: ${id}`);
    return config;
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.cDNConfig.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('CDN 配置不存在');
    }

    await this.prisma.cDNConfig.delete({ where: { id } });
    this.logger.log(`CDNConfig deleted: ${id}`);
    return { success: true };
  }

  // 清除缓存（模拟）
  async purgeCache(teamId: string, id: string, paths?: string[]) {
    const config = await this.findOne(teamId, id);

    // 实际实现需要调用 CDN 提供商 API
    this.logger.log(`Cache purged for ${config.domain}: ${paths?.join(', ') || 'all'}`);

    return {
      success: true,
      message: `缓存清除请求已提交（模拟）`,
      paths: paths || ['/*'],
    };
  }

  // 团队凭证管理
  async createCredential(teamId: string, dto: CreateCredentialDto) {
    const encryptedConfig = this.encrypt(JSON.stringify(dto.config));

    const credential = await this.prisma.teamCredential.create({
      data: {
        teamId,
        type: dto.type,
        name: dto.name,
        config: encryptedConfig,
      },
    });

    this.logger.log(`TeamCredential created: ${credential.id}`);
    return {
      id: credential.id,
      type: credential.type,
      name: credential.name,
      createdAt: credential.createdAt,
    };
  }

  async findAllCredentials(teamId: string, type?: string) {
    const where: any = { teamId };
    if (type) {
      where.type = type;
    }

    const credentials = await this.prisma.teamCredential.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { cdnConfigs: true } },
      },
    });

    return credentials;
  }

  async removeCredential(teamId: string, id: string) {
    const existing = await this.prisma.teamCredential.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('凭证不存在');
    }

    await this.prisma.teamCredential.delete({ where: { id } });
    this.logger.log(`TeamCredential deleted: ${id}`);
    return { success: true };
  }
}
