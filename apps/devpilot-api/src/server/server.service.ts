/**
 * 服务器领域服务（F383）：CRUD + 连接判定。
 * 单一职责：服务器实体的增删改查与连接/服务探测状态回写。
 * 凭据加解密与解密读取已抽离到 ServerCredentialAccessService；
 * 响应脱敏归一化已抽离到 formatServerResponse。
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServerDto, UpdateServerDto } from './dto/server.dto';
import {
  ServerConnectionCapabilityService,
  ServerConnectionCapability,
} from './server-connection-capability.service';
import { ServerCredentialAccessService } from './server-credential-access.service';
import { formatServerResponse } from './server-response-format.utils';

export type TestConnectionResult = ServerConnectionCapability & {
  success: boolean;
  status: string;
};

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialAccess: ServerCredentialAccessService,
    private readonly capabilityService: ServerConnectionCapabilityService,
  ) {}

  async create(teamId: string, userId: string, dto: CreateServerDto) {
    const server = await this.prisma.server.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        host: dto.host,
        port: dto.port || 22,
        username: dto.username,
        authType: dto.authType,
        credentials: this.credentialAccess.encrypt(dto.credentials),
        tags: dto.tags || [],
        status: 'unknown',
      },
    });
    this.logger.log(`Server created: ${server.id} (${dto.name})`);
    return formatServerResponse(server);
  }

  async findAll(teamId: string) {
    const servers = await this.prisma.server.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: this.listInclude(),
    });
    return servers.map((s) => formatServerResponse(s));
  }

  async findOne(teamId: string, id: string) {
    const server = await this.prisma.server.findFirst({
      where: { id, teamId },
      include: this.detailInclude(),
    });
    if (!server) throw new NotFoundException('服务器不存在');
    return formatServerResponse(server);
  }

  async update(teamId: string, id: string, dto: UpdateServerDto) {
    const existing = await this.prisma.server.findFirst({ where: { id, teamId } });
    if (!existing) throw new NotFoundException('服务器不存在');

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.credentials) updateData.credentials = this.credentialAccess.encrypt(dto.credentials);
    if (dto.tags) updateData.tags = dto.tags;

    const server = await this.prisma.server.update({ where: { id }, data: updateData });
    this.logger.log(`Server updated: ${id}`);
    return formatServerResponse(server);
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.server.findFirst({ where: { id, teamId } });
    if (!existing) throw new NotFoundException('服务器不存在');
    await this.prisma.server.delete({ where: { id } });
    this.logger.log(`Server deleted: ${id}`);
    return { success: true };
  }

  // 测试连接：委托 capability service 做网络/认证/执行器三段判定，再据此回写状态
  // 并补齐向后兼容的 success/status 字段。online 需三者齐备；认证/执行器问题归 degraded。
  async testConnection(teamId: string, id: string): Promise<TestConnectionResult> {
    const exists = await this.prisma.server.findFirst({ where: { id, teamId } });
    if (!exists) throw new NotFoundException('服务器不存在');

    const cap = await this.capabilityService.verifyCapability(teamId, id);
    const status = cap.executorCompatible
      ? 'online'
      : cap.networkReachable
        ? 'degraded'
        : 'offline';

    await this.prisma.server.update({ where: { id }, data: { status } }).catch(() => {
      // 状态回写失败不应掩盖真实的连接判定结果。
    });

    return { ...cap, success: cap.executorCompatible, status };
  }

  // 检测服务器上安装的服务（当前为模拟实现，真实探测走 SSH 命令——待 F7x 接入）。
  async detectServices(teamId: string, id: string) {
    const server = await this.prisma.server.findFirst({ where: { id, teamId } });
    if (!server) throw new NotFoundException('服务器不存在');
    const services = { nginx: false, docker: false, nodejs: false, pm2: false, mysql: false, redis: false };
    await this.prisma.server.update({ where: { id }, data: { services } });
    return { services, message: '服务检测完成（模拟数据）' };
  }

  // 获取解密后的凭据（内部使用——委派凭据访问服务，保留旧调用点签名）。
  getDecryptedCredentials(teamId: string, id: string) {
    return this.credentialAccess.getDecryptedCredentials(teamId, id);
  }

  private listInclude() {
    return {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { proxyConfigs: true } },
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
    };
  }

  private detailInclude() {
    return {
      createdBy: { select: { id: true, name: true, email: true } },
      proxyConfigs: { select: { id: true, name: true, domain: true, status: true } },
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
    };
  }
}
