/**
 * ServerExecutor 域内的 $DEVPILOT_* 秘密解析服务（F383 P0-A）。
 *
 * 单一职责：在 SSH live 执行边界（队列 worker rehydrate 之后）重新解析命令里
 * $DEVPILOT_<KEY> 占位引用对应的真实平台秘密，返回 {KEY: 明文} 内存映射。
 * 真实值只存在于调用栈内存，由 reapplySecretEnvExport 写入 step.secretEnvExport
 * （仅内存，落库前被 stripSecretEnv 剥离）。
 *
 * 本服务与 ReleaseCredentialResolverService 同源（都调用 resolveDeploymentEnvVars），
 * 但属于 server-executor 域，直接依赖全局 PrismaService + CryptoService，
 * 避免 ServerExecutorModule ↔ ReleaseOrchestrationModule 的运行时循环依赖
 * （跨模块 Symbol 注入在当前装配下不解析，故改用域内自包含解析）。
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto/crypto.service";
import {
  resolveDeploymentEnvVars,
  type EnvInjectionPrisma,
  type EnvInjectionCrypto,
} from "../deployment/deployment-env-injection.utils";

@Injectable()
export class ServerExecutorDevpilotSecretResolverService {
  private readonly logger = new Logger(ServerExecutorDevpilotSecretResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /** 解析 (teamId, projectId, environmentId) 维度的平台秘密映射（仅内存明文）。 */
  async resolveSecretEnv(
    teamId: string,
    projectId: string | null | undefined,
    environmentId: string | null | undefined,
  ): Promise<Record<string, string>> {
    if (!projectId || !environmentId) return {};
    try {
      return await resolveDeploymentEnvVars(
        this.prisma as unknown as EnvInjectionPrisma,
        this.buildCrypto(),
        teamId,
        projectId,
        environmentId,
      );
    } catch (err) {
      this.logger.warn(
        `ServerExecutor 解析 $DEVPILOT 秘密失败：${err instanceof Error ? err.message : String(err)}`,
      );
      return {};
    }
  }

  private buildCrypto(): EnvInjectionCrypto {
    return {
      decrypt: (t) => this.cryptoService.decryptGcm(t),
      decryptCbc: (t) => this.cryptoService.decryptCbc(t),
    };
  }
}
