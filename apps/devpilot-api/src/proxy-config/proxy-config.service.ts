import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Mustache from 'mustache';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProxyConfigDto, UpdateProxyConfigDto } from './dto/proxy-config.dto';
import { NGINX_CONFIG_TEMPLATE } from './nginx.template';

@Injectable()
export class ProxyConfigService {
  private readonly logger = new Logger(ProxyConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  async resolveConfigInputAccessScope(
    teamId: string,
    dto: { projectId?: string | null },
  ) {
    if (!dto.projectId?.trim()) {
      return {
        projectId: null,
        environmentId: null,
      };
    }

    const project = await this.prisma.project.findFirst({
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

  async getConfigAccessScope(teamId: string, id: string) {
    const config = await this.prisma.proxyConfig.findFirst({
      where: { id, teamId },
      select: { id: true, projectId: true },
    });

    if (!config) {
      throw new NotFoundException('代理配置不存在');
    }

    return {
      projectId: config.projectId,
      environmentId: null,
    };
  }

  async create(teamId: string, userId: string, dto: CreateProxyConfigDto) {
    const data: Prisma.ProxyConfigUncheckedCreateInput = {
      teamId,
      createdById: userId,
      name: dto.name,
      domain: dto.domain,
      upstreams: this.toJsonValue(dto.upstreams),
      ssl: this.toJsonValue(dto.ssl),
      websocket: dto.websocket ?? false,
      status: 'pending',
    };

    if (dto.customConfig !== undefined) {
      data.customConfig = dto.customConfig;
    }

    if (dto.serverId !== undefined) {
      data.serverId = dto.serverId;
    }

    if (dto.projectId !== undefined) {
      data.projectId = dto.projectId;
    }

    const config = await this.prisma.proxyConfig.create({
      data,
      include: {
        server: { select: { id: true, name: true, host: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`ProxyConfig created: ${config.id} (${dto.domain})`);
    return config;
  }

  async findAll(teamId: string) {
    return this.prisma.proxyConfig.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        server: { select: { id: true, name: true, host: true, status: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findOne(teamId: string, id: string) {
    const config = await this.prisma.proxyConfig.findFirst({
      where: { id, teamId },
      include: {
        server: { select: { id: true, name: true, host: true, port: true, status: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!config) {
      throw new NotFoundException('代理配置不存在');
    }

    return config;
  }

  async update(teamId: string, id: string, dto: UpdateProxyConfigDto) {
    const existing = await this.prisma.proxyConfig.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('代理配置不存在');
    }

    const data: Prisma.ProxyConfigUncheckedUpdateInput = {
      status: 'pending', // 修改后需要重新同步
    };

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.domain !== undefined) {
      data.domain = dto.domain;
    }

    if (dto.upstreams !== undefined) {
      data.upstreams = this.toJsonValue(dto.upstreams);
    }

    if (dto.ssl !== undefined) {
      data.ssl = this.toJsonValue(dto.ssl);
    }

    if (dto.websocket !== undefined) {
      data.websocket = dto.websocket;
    }

    if (dto.customConfig !== undefined) {
      data.customConfig = dto.customConfig;
    }

    if (dto.serverId !== undefined) {
      data.serverId = dto.serverId;
    }

    if (dto.projectId !== undefined) {
      data.projectId = dto.projectId;
    }

    const config = await this.prisma.proxyConfig.update({
      where: { id },
      data,
      include: {
        server: { select: { id: true, name: true, host: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`ProxyConfig updated: ${id}`);
    return config;
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.proxyConfig.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('代理配置不存在');
    }

    await this.prisma.proxyConfig.delete({ where: { id } });
    this.logger.log(`ProxyConfig deleted: ${id}`);
    return { success: true };
  }

  // 生成 Nginx 配置（mustache 模板渲染 + 空行规范化，取代 += 命令式拼接）
  generateNginxConfig(config: any): string {
    const upstreams = config.upstreams as Array<{ host: string; port?: number; weight?: number }>;
    const ssl = config.ssl as { enabled: boolean; type?: string };
    const upstreamName = config.domain.replace(/\./g, '_');
    const hasMultipleUpstreams = upstreams.length > 1;
    const proxyPass = hasMultipleUpstreams
      ? `http://${upstreamName}`
      : `http://${upstreams[0].host}:${upstreams[0].port || 80}`;
    const customConfigLines = config.customConfig
      ? String(config.customConfig).split('\n')
      : [];

    const rendered = Mustache.render(NGINX_CONFIG_TEMPLATE, {
      upstreamBlock: hasMultipleUpstreams,
      upstreamName,
      upstreamLines: upstreams.map((u) => ({
        host: u.host,
        port: u.port || 80,
        weight: u.weight && u.weight !== 1 ? u.weight : undefined,
      })),
      sslEnabled: ssl.enabled,
      letsencrypt: ssl.enabled && ssl.type === 'letsencrypt',
      domain: config.domain,
      proxyPass,
      websocket: !!config.websocket,
      hasCustomConfig: customConfigLines.length > 0,
      customConfigLines,
    });
    // 规范化 mustache standalone section 残留的多余空行（3+ 换行 → 2 个）
    return rendered.replace(/\n{3,}/g, '\n\n');
  }

  // 预览 Nginx 配置
  async preview(teamId: string, id: string) {
    const config = await this.findOne(teamId, id);
    return {
      config: this.generateNginxConfig(config),
      filename: `${config.domain}.conf`,
    };
  }

  // 同步配置到服务器（简化版）
  async sync(teamId: string, id: string) {
    const config = await this.prisma.proxyConfig.findFirst({
      where: { id, teamId },
      include: { server: true },
    });

    if (!config) {
      throw new NotFoundException('代理配置不存在');
    }

    if (!config.serverId) {
      throw new Error('未关联服务器');
    }

    // 简化版：只更新状态
    // 实际实现需要通过 SSH 写入配置文件并重载 Nginx
    await this.prisma.proxyConfig.update({
      where: { id },
      data: {
        status: 'active',
        lastSyncAt: new Date(),
        syncError: null,
      },
    });

    this.logger.log(`ProxyConfig synced: ${id}`);

    return {
      success: true,
      message: '配置已同步（模拟）',
      nginxConfig: this.generateNginxConfig(config),
    };
  }
}
