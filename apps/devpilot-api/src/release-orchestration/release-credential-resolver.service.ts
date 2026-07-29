/**
 * 发布阶段凭据解析服务（F383 P0-A）。
 *
 * 单一职责：在最靠近执行边界的位置，为发布阶段命令解析「平台预置的真实秘密」
 * （ResourceInstance 凭据 / ProjectEnvironment 普通环境变量 / SecretKey 密钥中心），
 * 返回纯内存的 {KEY: 明文值} 映射。真实值只存在于调用栈内存中，由适配器写入
 * step.secretEnvExport（落库前被 stripSecretEnv 剥离），绝不进入持久化模型。
 *
 * 与 DeploymentService.resolveEnvVarsSafe 同源（复用 resolveDeploymentEnvVars），
 * 但作为发布域独立服务，避免发布编排反向依赖 DeploymentService。
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
export class ReleaseCredentialResolverService {
  private readonly logger = new Logger(ReleaseCredentialResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * 解析 (teamId, projectId, environmentId) 维度的平台秘密映射。
   * 尽力而为：解析失败返回 {}，让适配器据此决定是 blocked 还是继续（绝不抛错中断发布，
   * 也绝不把错误信息里的秘密暴露出去）。真实值仅在返回的内存对象中。
   */
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
        `解析发布阶段秘密失败：${err instanceof Error ? err.message : String(err)}`,
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
