import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { isSupportedSshAuthType } from "../server-executor/adapters/ssh-credential-mapping.utils";

/**
 * 发布预览阶段的执行器能力预检（F383 §B preview preflight）。
 *
 * 目的：在创建发布之前就把「这台服务器能不能被 live 执行器使用」暴露给用户，
 * 而不是等到第一阶段执行后才失败。preview 不应被阻塞，故只产出结构化警告。
 *
 * 这是「结构性兼容」预检（server.authType 是否受支持 + live 开关），不做真实 SSH
 * 探测——后者属于 ServerConnectionCapabilityService 的连接测试，太重，不该在每次
 * 预览时执行。两者互补：预览给静态兼容性，连接测试给运行时可达性。
 */

export interface ReleaseExecutorPreflightWarning {
  applicationServiceId: string;
  serviceName: string;
  serverId: string;
  /** 机器可读的英文原因（日志/排查用）。 */
  reason: string;
  /** 面向平台新手的中文处理建议（UI 文案）。 */
  suggestedAction: string;
}

export interface ResolvedPreflightService {
  applicationServiceId: string;
  serviceName: string;
  serverId?: string | null;
}

@Injectable()
export class ReleaseExecutorPreflightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async computeWarnings(
    teamId: string,
    services: ResolvedPreflightService[],
  ): Promise<ReleaseExecutorPreflightWarning[]> {
    const liveEnabled = readLiveExecutorEnabled(this.config);
    const seen = new Set<string>();
    const warnings: ReleaseExecutorPreflightWarning[] = [];

    for (const svc of services) {
      if (!svc.serverId || seen.has(svc.serverId)) continue;
      seen.add(svc.serverId);

      const server = await this.prisma.server.findFirst({
        where: { id: svc.serverId, teamId },
        select: { id: true, authType: true, name: true },
      });
      if (!server) {
        warnings.push(
          this.warn(
            svc,
            "server record not found",
            "服务器记录不存在，请在环境绑定中重新选择目标服务器。",
          ),
        );
        continue;
      }
      if (!liveEnabled) {
        warnings.push(
          this.warn(
            svc,
            "live executor disabled",
            "实时发布执行器未启用（SERVER_EXECUTOR_LIVE_ENABLED）；请联系平台开启后再发布。",
          ),
        );
        continue;
      }
      if (!isSupportedSshAuthType(server.authType)) {
        warnings.push(
          this.warn(
            svc,
            `unsupported authType: ${server.authType ?? "(空)"}`,
            `服务器「${server.name}」的认证类型不被 live 执行器支持；请改为 key 或 password。`,
          ),
        );
      }
    }
    return warnings;
  }

  private warn(
    svc: ResolvedPreflightService,
    reason: string,
    suggestedAction: string,
  ): ReleaseExecutorPreflightWarning {
    return {
      applicationServiceId: svc.applicationServiceId,
      serviceName: svc.serviceName,
      serverId: svc.serverId!,
      reason,
      suggestedAction,
    };
  }
}

function readLiveExecutorEnabled(config: ConfigService): boolean {
  const v = config.get("SERVER_EXECUTOR_LIVE_ENABLED", "false");
  return v === true || v === "true";
}
