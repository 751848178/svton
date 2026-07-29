import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import {
  isSupportedSshAuthType,
  buildUnsupportedAuthTypeMessage,
  SSH_CAPABILITY_PROBE_COMMAND,
} from "../server-executor/adapters/ssh-credential-mapping.utils";
import { checkPortReachable } from "./tcp-reachability.utils";
import {
  capabilityNotFound,
  executorEnabledRecommendation,
  readLiveExecutorEnabled,
  sanitizeAuthMessage,
} from "./capability-message.utils";

/**
 * 服务器连接能力检测（F383 §B）。把判定拆成三段：
 *  1. networkReachable — TCP 端口是否开放
 *  2. authenticationVerified — 真实 SSH 握手 + 凭据认证 + 最小无副作用命令 `true`
 *  3. executorCompatible — live executor 开关 + 受支持 authType + 传输可用
 * 任一不通过都给出可操作的 recommendation。安全：密码/私钥只在本次检测的内存中
 * 用于 SSH 连接，绝不进入返回结果。文案/开关/探活已抽离到 capability-message/tcp utils。
 */
export interface ServerConnectionCapability {
  authType: string | null;
  networkReachable: boolean;
  authenticationVerified: boolean;
  executorCompatible: boolean;
  latency: number;
  message: string;
  recommendation?: string;
}

@Injectable()
export class ServerConnectionCapabilityService {
  private readonly logger = new Logger(ServerConnectionCapabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly sshTransportFactory: SshTransportFactory,
    private readonly configService: ConfigService,
  ) {}

  async verifyCapability(
    teamId: string,
    serverId: string,
  ): Promise<ServerConnectionCapability> {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, teamId },
    });
    if (!server) return capabilityNotFound();

    const startedAt = Date.now();
    const networkReachable = await this.checkPortReachable(server.host, server.port);
    const latency = Date.now() - startedAt;

    if (!networkReachable) {
      return {
        authType: server.authType,
        networkReachable: false,
        authenticationVerified: false,
        executorCompatible: false,
        latency,
        message: `无法连接到 ${server.host}:${server.port}（网络不可达）`,
        recommendation: "检查服务器主机/端口、安全组与防火墙规则后重试。",
      };
    }

    const authType = server.authType;
    if (!isSupportedSshAuthType(authType)) {
      return {
        authType,
        networkReachable: true,
        authenticationVerified: false,
        executorCompatible: false,
        latency,
        message: buildUnsupportedAuthTypeMessage(authType),
        recommendation:
          `平台当前支持的认证方式：key / password。请在服务器「${server.name}」` +
          `配置中改用受支持的认证方式。`,
      };
    }

    const liveEnabled = readLiveExecutorEnabled(this.configService);
    const plaintext = this.cryptoService.decryptGcm(server.credentials);
    const authResult = await this.verifySshAuth({
      host: server.host,
      port: server.port,
      username: server.username,
      authType,
      secret: plaintext,
    });

    const executorCompatible = liveEnabled && authResult.verified;
    return {
      authType,
      networkReachable: true,
      authenticationVerified: authResult.verified,
      executorCompatible,
      latency,
      message: authResult.verified
        ? executorCompatible
          ? "连接成功：网络可达、SSH 认证通过、可用于实时发布。"
          : "SSH 认证通过，但实时执行器未启用。"
        : authResult.message,
      recommendation: authResult.verified
        ? executorEnabledRecommendation(liveEnabled)
        : "请核对用户名与凭据（密码或私钥）；确认服务器 sshd 允许该认证方式。",
    };
  }

  private async verifySshAuth(input: {
    host: string;
    port: number;
    username: string;
    authType: "key" | "password";
    secret: string;
  }): Promise<{ verified: boolean; message: string }> {
    let transport: ReturnType<typeof this.sshTransportFactory.create> | undefined;
    try {
      transport = this.sshTransportFactory.create({
        host: input.host,
        port: input.port,
        username: input.username,
        [input.authType === "key" ? "privateKey" : "password"]: input.secret,
      });
      const result = await transport.execCommand(SSH_CAPABILITY_PROBE_COMMAND, {
        timeoutMs: 12_000,
      });
      if (result.exitCode === 0) return { verified: true, message: "SSH 认证通过。" };
      return { verified: false, message: `SSH 认证通过但探测命令退出码为 ${result.exitCode}。` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SSH 连接失败";
      this.logger.warn(`SSH capability probe failed for ${input.host}: ${msg}`);
      return { verified: false, message: sanitizeAuthMessage(msg) };
    } finally {
      transport?.dispose?.();
    }
  }

  /** TCP 可达性检测（protected 以便单测覆写，避免真实网络抖动）。 */
  protected checkPortReachable(host: string, port: number): Promise<boolean> {
    return checkPortReachable(host, port);
  }
}
