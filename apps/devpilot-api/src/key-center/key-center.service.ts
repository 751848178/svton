import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { GenerateKeyDto, StoreKeyDto, KeyType } from './dto/key-center.dto';

@Injectable()
export class KeyCenterService {
  private readonly logger = new Logger(KeyCenterService.name);
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!';

  constructor(private readonly prisma: PrismaService) {}

  // 加密
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // 解密
  private decrypt(text: string): string {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // 生成密钥
  generateKey(dto: GenerateKeyDto): { key: string; type: string } {
    const length = dto.length || this.getDefaultLength(dto.type);
    let key: string;

    switch (dto.type) {
      case KeyType.JWT_SECRET:
        key = crypto.randomBytes(length).toString('base64').slice(0, length);
        break;
      case KeyType.ENCRYPTION_KEY:
        key = crypto.randomBytes(32).toString('base64').slice(0, 32);
        break;
      case KeyType.API_KEY:
        key = `sk_${crypto.randomBytes(length).toString('hex').slice(0, length)}`;
        break;
      case KeyType.OAUTH_SECRET:
        key = crypto.randomBytes(length).toString('hex').slice(0, length);
        break;
      case KeyType.DATABASE_PASSWORD:
        key = this.generateSecurePassword(length);
        break;
      default:
        key = crypto.randomBytes(length).toString('base64').slice(0, length);
    }

    this.logger.log(`Generated ${dto.type} key`);
    return { key, type: dto.type };
  }

  // 生成安全密码（包含大小写字母、数字、特殊字符）
  private generateSecurePassword(length: number): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = lowercase + uppercase + numbers + special;

    let password = '';
    // 确保至少包含每种字符
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // 填充剩余长度
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // 打乱顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  private getDefaultLength(type: KeyType): number {
    switch (type) {
      case KeyType.JWT_SECRET: return 64;
      case KeyType.ENCRYPTION_KEY: return 32;
      case KeyType.API_KEY: return 32;
      case KeyType.OAUTH_SECRET: return 40;
      case KeyType.DATABASE_PASSWORD: return 24;
      default: return 32;
    }
  }

  // 存储密钥
  async storeKey(teamId: string, userId: string, dto: StoreKeyDto) {
    const encryptedValue = this.encrypt(dto.value);

    const key = await this.prisma.secretKey.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        type: dto.type,
        value: encryptedValue,
        description: dto.description,
        projectId: dto.projectId,
      },
    });

    this.logger.log(`Stored key: ${dto.name} for team ${teamId}`);
    return this.formatKeyResponse(key);
  }

  // 获取团队的所有密钥（不返回值）
  async getKeys(teamId: string, projectId?: string) {
    const where: any = { teamId };
    if (projectId) {
      where.projectId = projectId;
    }

    const keys = await this.prisma.secretKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return keys.map((k: any) => this.formatKeyResponse(k));
  }

  // 获取密钥值（需要验证）
  async getKeyValue(teamId: string, keyId: string): Promise<string> {
    const key = await this.prisma.secretKey.findFirst({
      where: { id: keyId, teamId },
    });

    if (!key) {
      throw new NotFoundException('Key not found');
    }

    // 记录访问日志
    this.logger.log(`Key ${key.name} accessed in team ${teamId}`);

    return this.decrypt(key.value);
  }

  // 更新密钥
  async updateKey(teamId: string, keyId: string, dto: Partial<StoreKeyDto>) {
    const key = await this.prisma.secretKey.findFirst({
      where: { id: keyId, teamId },
    });

    if (!key) {
      throw new NotFoundException('Key not found');
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.value) updateData.value = this.encrypt(dto.value);

    const updated = await this.prisma.secretKey.update({
      where: { id: keyId },
      data: updateData,
    });

    return this.formatKeyResponse(updated);
  }

  // 删除密钥
  async deleteKey(teamId: string, keyId: string) {
    const key = await this.prisma.secretKey.findFirst({
      where: { id: keyId, teamId },
    });

    if (!key) {
      throw new NotFoundException('Key not found');
    }

    await this.prisma.secretKey.delete({ where: { id: keyId } });
    this.logger.log(`Deleted key: ${key.name}`);
    return { success: true };
  }

  // 批量生成项目所需的密钥
  async generateProjectKeys(teamId: string, userId: string, projectId: string, projectName: string) {
    const keys = [
      { type: KeyType.JWT_SECRET, name: `${projectName}_JWT_SECRET` },
      { type: KeyType.ENCRYPTION_KEY, name: `${projectName}_ENCRYPTION_KEY` },
      { type: KeyType.DATABASE_PASSWORD, name: `${projectName}_DB_PASSWORD` },
    ];

    const results = [];
    for (const keyConfig of keys) {
      const generated = this.generateKey({ type: keyConfig.type });
      const stored = await this.storeKey(teamId, userId, {
        name: keyConfig.name,
        type: keyConfig.type,
        value: generated.key,
        projectId,
      });
      results.push({ ...stored, value: generated.key });
    }

    return results;
  }

  // 导出项目密钥为 .env 格式
  async exportAsEnv(teamId: string, projectId: string): Promise<string> {
    const keys = await this.prisma.secretKey.findMany({
      where: { teamId, projectId },
    });

    const lines = ['# Auto-generated secrets', `# Project ID: ${projectId}`, ''];
    for (const key of keys) {
      const value = this.decrypt(key.value);
      const envKey = key.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      lines.push(`${envKey}=${value}`);
    }

    return lines.join('\n');
  }

  private formatKeyResponse(key: any) {
    return {
      id: key.id,
      name: key.name,
      type: key.type,
      description: key.description,
      projectId: key.projectId,
      createdBy: key.createdBy,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }
}
