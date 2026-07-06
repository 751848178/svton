import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { CdnRefreshProviderFactory } from './providers/cdn-refresh-provider.factory';
import { CreateCDNConfigDto, UpdateCDNConfigDto, CreateCredentialDto } from './dto/cdn-config.dto';

@Injectable()
export class CDNConfigService {
  private readonly logger = new Logger(CDNConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly cdnProviderFactory: CdnRefreshProviderFactory,
  ) {}

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private encrypt(text: string): string {
    return this.cryptoService.encryptGcm(text);
  }

  private decrypt(text: string): string {
    return this.cryptoService.decryptGcm(text);
  }

  // CDN 配置 CRUD
  async create(teamId: string, userId: string, dto: CreateCDNConfigDto) {
    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId;
    await this.ensureProject(teamId, projectId);

    const data: Prisma.CDNConfigUncheckedCreateInput = {
      teamId,
      createdById: userId,
      name: dto.name,
      domain: dto.domain,
      origin: dto.origin,
      provider: dto.provider,
      credentialId: dto.credentialId,
      projectId,
      environmentId: environmentRef?.id,
      cacheRules: this.toJsonValue(dto.cacheRules ?? []),
      status: 'pending',
    };

    const config = await this.prisma.cDNConfig.create({
      data,
      include: {
        credential: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
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
        environment: { select: { id: true, key: true, name: true, status: true } },
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
        environment: { select: { id: true, key: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!config) {
      throw new NotFoundException('CDN 配置不存在');
    }

    return config;
  }

  async resolveConfigInputAccessScope(
    teamId: string,
    dto: Pick<CreateCDNConfigDto | UpdateCDNConfigDto, 'projectId' | 'environmentId'>,
  ) {
    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId ?? null;
    await this.ensureProject(teamId, projectId || undefined);
    return {
      projectId,
      environmentId: environmentRef?.id ?? null,
    };
  }

  async getConfigAccessScope(teamId: string, id: string) {
    const config = await this.findOne(teamId, id);
    return {
      projectId: config.projectId,
      environmentId: config.environmentId,
    };
  }

  async update(teamId: string, id: string, dto: UpdateCDNConfigDto) {
    const existing = await this.prisma.cDNConfig.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('CDN 配置不存在');
    }

    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId;
    await this.ensureProject(teamId, projectId);

    const data: Prisma.CDNConfigUncheckedUpdateInput = {
      status: 'pending',
    };

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.domain !== undefined) {
      data.domain = dto.domain;
    }

    if (dto.origin !== undefined) {
      data.origin = dto.origin;
    }

    if (dto.cacheRules !== undefined) {
      data.cacheRules = this.toJsonValue(dto.cacheRules);
    }

    if (dto.projectId !== undefined) {
      data.projectId = projectId || null;
    }

    if (dto.environmentId !== undefined) {
      data.environmentId = environmentRef?.id || null;
      if (environmentRef) {
        data.projectId = environmentRef.projectId;
      }
    }

    const config = await this.prisma.cDNConfig.update({
      where: { id },
      data,
      include: {
        credential: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
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

  /**
   * 清除 CDN 缓存。
   *
   * 取代原模拟实现（`// 实际实现需要调用 CDN 提供商 API`）：解密团队凭据后，
   * 通过对应厂商 SDK 实际提交刷新请求。
   */
  async purgeCache(teamId: string, id: string, paths?: string[]) {
    const config = await this.findOne(teamId, id);
    const urls = paths && paths.length > 0 ? paths : [`https://${config.domain}/`];
    const isDirectory = urls.some((url) => url.endsWith('/'));

    if (!config.credentialId) {
      throw new BadRequestException('该 CDN 配置未关联团队凭据，无法刷新');
    }

    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: config.credentialId, teamId },
      select: { config: true },
    });
    if (!credential) {
      throw new NotFoundException('关联的团队凭据不存在');
    }

    let rawConfig: Record<string, unknown>;
    try {
      rawConfig = JSON.parse(this.decrypt(credential.config));
    } catch {
      throw new BadRequestException('团队凭据配置解析失败');
    }

    const provider = this.cdnProviderFactory.resolve(config.provider);
    const result = await provider.purge({ raw: rawConfig }, urls, isDirectory);
    this.logger.log(
      `CDN cache purged for ${config.domain} via ${config.provider}: urls=${urls.length}${result.requestId ? `, requestId=${result.requestId}` : ''}`,
    );

    return {
      success: true,
      message: `缓存清除请求已提交（${config.provider}）`,
      requestId: result.requestId,
      paths: urls,
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

  private async ensureProject(teamId: string, projectId?: string) {
    if (!projectId) return null;

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或不属于当前团队');
    }

    return project;
  }

  private async resolveProjectEnvironment(
    teamId: string,
    environmentId?: string,
    projectId?: string,
  ) {
    if (!environmentId) return null;

    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在或已归档');
    }

    if (projectId && environment.projectId !== projectId) {
      throw new BadRequestException('项目环境不属于所选项目');
    }

    return environment;
  }
}
