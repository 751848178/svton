/**
 * 服务器凭据访问服务（F383 结构约束拆分）。
 * 单一职责：加密 / 解密 / 读取服务器凭据——把「凭据如何在持久层与内存间转换」
 * 从 CRUD/连接判定里隔离出来。AES-256-GCM 对称加解密沿用 CryptoService。
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';

@Injectable()
export class ServerCredentialAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /** AES-256-GCM 加密。 */
  encrypt(text: string): string {
    return this.cryptoService.encryptGcm(text);
  }

  /** AES-256-GCM 解密。 */
  decrypt(text: string): string {
    return this.cryptoService.decryptGcm(text);
  }

  /** 读取并解密目标服务器的连接凭据（host/port/username/authType/credentials 明文）。 */
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
}
