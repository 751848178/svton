/**
 * 发布计划服务归属与目标环境一致性校验（F383 Slice 8a, invest-3 §A.2 + 第三轮 P0-1）。
 *
 * 从 ReleasePlanController 抽离的 DB 级访问校验：
 *   1. ApplicationService 必须属于同 team/project/application/environment；
 *   2. 若 DTO 声明 serverId，需匹配 ApplicationService.serverId 或绑到同 env 的
 *      ProjectEnvironmentServer；
 *   3. svc.environmentId === dto.environmentId（硬保证，控制器入口已断言）。
 * 同时从 deployConfig 服务端读取阶段命令字段（DTO 不再承载原始 shell 命令——
 * invest-3 §A.5），并读取该服务声明的跨服务发布依赖边（P0-1）。
 *
 * 控制器只做 HTTP 翻译（抛 ForbiddenException→403）；本服务持有 PrismaService。
 */
import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { readServiceDeployConfig } from "./utils/release-service-config.utils";
import type { ReleaseServiceInputDto } from "./dto/release-plan.dto";
import {
  ReleaseDependencyResolverService,
  type ReleaseDependencyResolution,
} from "./release-dependency-resolver.service";

// builder 接受的服务输入形状（与 utils/release-plan-builder ReleaseServiceInput 等价，
// 但本服务不依赖 builder 内部类型，避免反向耦合）。
export interface ResolvedReleaseService {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string | null;
  serviceName: string;
  workingDirectory?: string;
  preStartCheckCommand?: string;
  migrationCommand?: string;
  initializationCommand?: string;
  deployCommand?: string;
  healthCheckUrl?: string;
  backfillCommand?: string;
  backfillRequired?: boolean;
}

// 校验失败抛 ForbiddenException 的载荷（控制器透传到 HTTP 403）。
export interface ReleaseServiceAccessError {
  code: "RELEASE_ENVIRONMENT_MISMATCH" | "RELEASE_SERVICE_NOT_IN_TARGET_ENV";
  message: string;
}

@Injectable()
export class ReleasePlanAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dependencyResolver: ReleaseDependencyResolverService,
  ) {}

  // 对每个 DTO 服务做 DB 级 + 环境一致性校验，并从 deployConfig 服务端读取命令字段。
  // 任何校验失败抛带 code 的 ForbiddenException；成功返回装配好的服务输入数组。
  async assertAndResolve(
    teamId: string,
    projectId: string,
    planEnvironmentId: string,
    services: ReleaseServiceInputDto[],
  ): Promise<ResolvedReleaseService[]> {
    const resolved: ResolvedReleaseService[] = [];
    for (const svc of services) {
      // 硬保证：DTO 声明的环境必须等于计划目标环境。
      if (!svc.environmentId || svc.environmentId !== planEnvironmentId) {
        throw this.forbidden({
          code: "RELEASE_ENVIRONMENT_MISMATCH",
          message: `服务 ${svc.applicationServiceId} 的环境与发布目标环境不一致`,
        });
      }
      const app = await this.prisma.applicationService.findFirst({
        where: {
          id: svc.applicationServiceId,
          teamId,
          projectId,
          applicationId: svc.applicationId,
          environmentId: planEnvironmentId,
        },
        select: { id: true, serverId: true, environmentId: true, deployConfig: true },
      });
      if (!app) {
        throw this.forbidden({
          code: "RELEASE_SERVICE_NOT_IN_TARGET_ENV",
          message: "服务不属于该项目/团队/目标环境",
        });
      }
      if (svc.serverId && app.serverId !== svc.serverId) {
        // 允许 DTO 指向同 env 下 ProjectEnvironmentServer 绑定的另一台服务器。
        const bound = await this.prisma.projectEnvironmentServer.findFirst({
          where: {
            teamId,
            projectId,
            environmentId: planEnvironmentId,
            serverId: svc.serverId,
          },
          select: { id: true },
        });
        if (!bound) {
          throw this.forbidden({
            code: "RELEASE_SERVICE_NOT_IN_TARGET_ENV",
            message: "服务器不属于该目标环境",
          });
        }
      }
      const cmds = readServiceDeployConfig(app.deployConfig);
      resolved.push({
        applicationId: svc.applicationId,
        applicationServiceId: svc.applicationServiceId,
        environmentId: svc.environmentId,
        serverId: svc.serverId ?? app.serverId ?? null,
        serviceName: svc.serviceName,
        workingDirectory: cmds.workingDirectory,
        preStartCheckCommand: cmds.preStartCheckCommand,
        migrationCommand: cmds.migrationCommand,
        initializationCommand: cmds.initializationCommand,
        deployCommand: cmds.deployCommand,
        healthCheckUrl: cmds.healthCheckUrl,
        backfillCommand: cmds.backfillCommand,
        backfillRequired: svc.backfillRequired,
      });
    }
    return resolved;
  }

  // 跨服务依赖解析（P0-1 + Item 1 fail-closed）委托给 ReleaseDependencyResolverService。
  // 保留本入口以维持控制器已有调用形状不变（API 行为兼容）。preview/create 共用，
  // 故两者校验逻辑完全一致（Item 1 §4）。详细语义见 release-dependency-resolver.service.ts。
  // P0-2(b)：返回 { edges, warnings }，warnings 必须回传 UI。
  async resolveServiceDependencies(
    teamId: string,
    projectId: string,
    environmentId: string,
    services: ResolvedReleaseService[],
  ): Promise<ReleaseDependencyResolution> {
    return this.dependencyResolver.resolveDependencies(
      teamId,
      projectId,
      environmentId,
      services,
    );
  }

  private forbidden(err: ReleaseServiceAccessError): never {
    // Nest 拦截器把 ForbiddenException 的 response 透传到 HTTP body。
    throw new ForbiddenException(err);
  }
}
