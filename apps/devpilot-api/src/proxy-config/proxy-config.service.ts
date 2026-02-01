import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProxyConfigDto, UpdateProxyConfigDto } from './dto/proxy-config.dto';

@Injectable()
export class ProxyConfigService {
  private readonly logger = new Logger(ProxyConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(teamId: string, userId: string, dto: CreateProxyConfigDto) {
    const config = await this.prisma.proxyConfig.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        domain: dto.domain,
        upstreams: dto.upstreams,
        ssl: dto.ssl,
        websocket: dto.websocket || false,
        customConfig: dto.customConfig,
        serverId: dto.serverId,
        projectId: dto.projectId,
        status: 'pending',
      },
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

    const config = await this.prisma.proxyConfig.update({
      where: { id },
      data: {
        ...dto,
        status: 'pending', // 修改后需要重新同步
      },
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

  // 生成 Nginx 配置
  generateNginxConfig(config: any): string {
    const upstreams = config.upstreams as Array<{ host: string; port?: number; weight?: number }>;
    const ssl = config.ssl as { enabled: boolean; type?: string };
    const upstreamName = config.domain.replace(/\./g, '_');

    let nginxConfig = '';

    // Upstream 配置
    if (upstreams.length > 1) {
      nginxConfig += `upstream ${upstreamName} {\n`;
      for (const upstream of upstreams) {
        nginxConfig += `    server ${upstream.host}:${upstream.port || 80}`;
        if (upstream.weight && upstream.weight !== 1) {
          nginxConfig += ` weight=${upstream.weight}`;
        }
        nginxConfig += ';\n';
      }
      nginxConfig += '}\n\n';
    }

    // Server 配置
    nginxConfig += `server {\n`;
    
    if (ssl.enabled) {
      nginxConfig += `    listen 443 ssl http2;\n`;
      nginxConfig += `    listen [::]:443 ssl http2;\n`;
    } else {
      nginxConfig += `    listen 80;\n`;
      nginxConfig += `    listen [::]:80;\n`;
    }
    
    nginxConfig += `    server_name ${config.domain};\n\n`;

    // SSL 配置
    if (ssl.enabled) {
      if (ssl.type === 'letsencrypt') {
        nginxConfig += `    ssl_certificate /etc/letsencrypt/live/${config.domain}/fullchain.pem;\n`;
        nginxConfig += `    ssl_certificate_key /etc/letsencrypt/live/${config.domain}/privkey.pem;\n`;
      } else {
        nginxConfig += `    ssl_certificate /etc/nginx/ssl/${config.domain}.crt;\n`;
        nginxConfig += `    ssl_certificate_key /etc/nginx/ssl/${config.domain}.key;\n`;
      }
      nginxConfig += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
      nginxConfig += `    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;\n\n`;
    }

    // Location 配置
    nginxConfig += `    location / {\n`;
    
    const proxyPass = upstreams.length > 1 
      ? `http://${upstreamName}`
      : `http://${upstreams[0].host}:${upstreams[0].port || 80}`;
    
    nginxConfig += `        proxy_pass ${proxyPass};\n`;
    nginxConfig += `        proxy_http_version 1.1;\n`;
    nginxConfig += `        proxy_set_header Host $host;\n`;
    nginxConfig += `        proxy_set_header X-Real-IP $remote_addr;\n`;
    nginxConfig += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`;
    nginxConfig += `        proxy_set_header X-Forwarded-Proto $scheme;\n`;

    // WebSocket 支持
    if (config.websocket) {
      nginxConfig += `        proxy_set_header Upgrade $http_upgrade;\n`;
      nginxConfig += `        proxy_set_header Connection "upgrade";\n`;
    }

    nginxConfig += `    }\n`;

    // 自定义配置
    if (config.customConfig) {
      nginxConfig += `\n    # Custom configuration\n`;
      nginxConfig += config.customConfig.split('\n').map((line: string) => `    ${line}`).join('\n');
      nginxConfig += '\n';
    }

    nginxConfig += `}\n`;

    // HTTP 重定向到 HTTPS
    if (ssl.enabled) {
      nginxConfig += `\nserver {\n`;
      nginxConfig += `    listen 80;\n`;
      nginxConfig += `    listen [::]:80;\n`;
      nginxConfig += `    server_name ${config.domain};\n`;
      nginxConfig += `    return 301 https://$server_name$request_uri;\n`;
      nginxConfig += `}\n`;
    }

    return nginxConfig;
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
