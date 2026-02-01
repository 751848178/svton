import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServerDto, UpdateServerDto, AuthType } from './dto/server.dto';
import * as crypto from 'crypto';

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!';

  constructor(private readonly prisma: PrismaService) {}

  // AES-256-GCM 加密
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  // AES-256-GCM 解密
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

  // 测试连接（简化版，实际需要 SSH 库）
  async testConnection(teamId: string, id: string) {
    const server = await this.prisma.server.findFirst({
      where: { id, teamId },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在');
    }

    const startTime = Date.now();
    
    try {
      // 简化的连接测试：使用 TCP 连接测试端口是否开放
      const isReachable = await this.checkPortReachable(server.host, server.port);
      const latency = Date.now() - startTime;

      const status = isReachable ? 'online' : 'offline';
      
      await this.prisma.server.update({
        where: { id },
        data: { status },
      });

      return {
        success: isReachable,
        status,
        latency,
        message: isReachable ? '连接成功' : '无法连接到服务器',
      };
    } catch (error) {
      await this.prisma.server.update({
        where: { id },
        data: { status: 'offline' },
      });

      return {
        success: false,
        status: 'offline',
        latency: Date.now() - startTime,
        message: error instanceof Error ? error.message : '连接失败',
      };
    }
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

  private async checkPortReachable(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(5000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, host);
    });
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
