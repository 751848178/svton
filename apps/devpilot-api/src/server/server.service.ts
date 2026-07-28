import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { CreateServerDto, UpdateServerDto, AuthType } from './dto/server.dto';
import {
  ServerConnectionCapabilityService,
  ServerConnectionCapability,
} from './server-connection-capability.service';

export type TestConnectionResult = ServerConnectionCapability & {
  success: boolean;
  status: string;
};

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly capabilityService: ServerConnectionCapabilityService,
  ) {}

  // AES-256-GCM 加密
  private encrypt(text: string): string {
    return this.cryptoService.encryptGcm(text);
  }

  // AES-256-GCM 解密
  private decrypt(text: string): string {
    return this.cryptoService.decryptGcm(text);
  }

  async create(teamId: string, userId: string, dto: CreateServerDto) {
    const encryptedCredentials = this.encrypt(dto.credentials);

    const server = await this.prisma.server.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        host: dto.host,
        port: dto.port || 22,
        username: dto.username,
        authType: dto.authType,
        credentials: encryptedCredentials,
        tags: dto.tags || [],
        status: 'unknown',
      },
    });

    this.logger.log(`Server created: ${server.id} (${dto.name})`);

    return this.formatServerResponse(server);
  }

  async findAll(teamId: string) {
    const servers = await this.prisma.server.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { proxyConfigs: true },
        },
        environmentBindings: {
          where: { status: 'active' },
          select: {
            id: true,
            projectId: true,
            environmentId: true,
            role: true,
            environment: { select: { id: true, key: true, name: true, status: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    return servers.map((s) => this.formatServerResponse(s));
  }

  async findOne(teamId: string, id: string) {
    const server = await this.prisma.server.findFirst({
      where: { id, teamId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        proxyConfigs: {
          select: {
            id: true,
            name: true,
            domain: true,
            status: true,
          },
        },
        environmentBindings: {
          where: { status: 'active' },
          select: {
            id: true,
            projectId: true,
            environmentId: true,
            role: true,
            environment: { select: { id: true, key: true, name: true, status: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在');
    }

    return this.formatServerResponse(server);
  }

  async update(teamId: string, id: string, dto: UpdateServerDto) {
    const existing = await this.prisma.server.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('服务器不存在');
    }

    const updateData: any = { ...dto };
    if (dto.credentials) {
      updateData.credentials = this.encrypt(dto.credentials);
    }
    if (dto.tags) {
      updateData.tags = dto.tags;
    }

    const server = await this.prisma.server.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Server updated: ${id}`);

    return this.formatServerResponse(server);
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.server.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('服务器不存在');
    }

    await this.prisma.server.delete({ where: { id } });

    this.logger.log(`Server deleted: ${id}`);

    return { success: true };
  }

  // 测试连接：委托 capability service 做网络/认证/执行器三段判定，
  // 再据此回写状态并补齐向后兼容的 success/status/message 字段。
  async testConnection(teamId: string, id: string): Promise<TestConnectionResult> {
    const exists = await this.prisma.server.findFirst({ where: { id, teamId } });
    if (!exists) {
      throw new NotFoundException('服务器不存在');
    }

    const cap = await this.capabilityService.verifyCapability(teamId, id);
    // online 仅在「网络可达 + 认证通过 + 执行器可用」三者齐备时；
    // 认证未通过或执行器未启用都归为 degraded，避免把不可用伪装成 online。
    const status = cap.executorCompatible
      ? 'online'
      : cap.networkReachable
        ? 'degraded'
        : 'offline';

    await this.prisma.server.update({ where: { id }, data: { status } }).catch(() => {
      // 状态回写失败不应掩盖真实的连接判定结果。
    });

    return {
      ...cap,
      success: cap.executorCompatible,
      status,
    };
  }

  // 检测服务器上安装的服务
  async detectServices(teamId: string, id: string) {
    const server = await this.prisma.server.findFirst({
      where: { id, teamId },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在');
    }

    // 简化版：返回模拟数据
    // 实际实现需要通过 SSH 执行命令检测
    const services = {
      nginx: false,
      docker: false,
      nodejs: false,
      pm2: false,
      mysql: false,
      redis: false,
    };

    await this.prisma.server.update({
      where: { id },
      data: { services },
    });

    return {
      services,
      message: '服务检测完成（模拟数据）',
    };
  }

  // 获取解密后的凭证（内部使用）
  async getDecryptedCredentials(teamId: string, id: string) {
    const server = await this.prisma.server.findFirst({
      where: { id, teamId },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在');
    }

    return {
      host: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      credentials: this.decrypt(server.credentials),
    };
  }

  private formatServerResponse(server: any) {
    const { credentials, ...rest } = server;
    return {
      ...rest,
      tags: server.tags || [],
      services: server.services || {},
    };
  }
}
