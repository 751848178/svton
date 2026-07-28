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
import {
  readServiceDeployConfig,
  readServiceReleaseDependencies,
  type DeclaredServiceDependencyEdge,
} from "./utils/release-service-config.utils";
import type { ServiceDependencyEdge } from "./utils/release-cross-service-edges.utils";
import type { ReleaseServiceInputDto } from "./dto/release-plan.dto";

// builder 接受的服务输入形状（与 utils/release-plan-builder ReleaseServiceInput 等价，
// 但本服务不依赖 builder 内部类型，避免反向耦合）。
export interface ResolvedReleaseService {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string | null;
  serviceName: string;
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
  constructor(private readonly prisma: PrismaService) {}

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

  // 从已校验服务集合 + 它们各自 deployConfig 声明的出向边，组装 builder 需要的
  // 跨服务依赖边（P0-1）。fromServiceId 用所属服务 id；toServiceId 必须落在已选
  // 已校验集合内——否则该边被丢弃（不阻断发布，避免引用未参与本计划的服务）。
  // 因为每个 resolved service 都过了 assertAndResolve 的 team/project/env 归属校验，
  // 保留的边天然满足「两端同 team/project/目标 environment」。
  async resolveServiceDependencies(
    teamId: string,
    projectId: string,
    environmentId: string,
    services: ResolvedReleaseService[],
  ): Promise<ServiceDependencyEdge[]> {
    const selectedIds = new Set(services.map((s) => s.applicationServiceId));
    if (selectedIds.size === 0) return [];
    // 一次性拉取所有已选服务的 deployConfig（避免 N+1）。
    const rows = await this.prisma.applicationService.findMany({
      where: { id: { in: [...selectedIds] }, teamId, projectId, environmentId },
      select: { id: true, deployConfig: true },
    });
    const configById = new Map(rows.map((r) => [r.id, r.deployConfig]));
    const out: ServiceDependencyEdge[] = [];
    for (const svc of services) {
      const cfg = configById.get(svc.applicationServiceId);
      const declared: DeclaredServiceDependencyEdge[] =
        readServiceReleaseDependencies(cfg);
      for (const d of declared) {
        if (!selectedIds.has(d.toServiceId)) continue; // 下游不在本计划 → 丢弃
        if (d.toServiceId === svc.applicationServiceId) continue; // 不允许自环
        out.push({
          fromServiceId: svc.applicationServiceId,
          fromStageType: d.fromStageType,
          toServiceId: d.toServiceId,
          toStageType: d.toStageType,
          conditionType: d.conditionType,
          required: d.required,
        });
      }
    }
    return out;
  }

  private forbidden(err: ReleaseServiceAccessError): never {
    // Nest 拦截器把 ForbiddenException 的 response 透传到 HTTP body。
    throw new ForbiddenException(err);
  }
}
