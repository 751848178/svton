/**
 * 跨服务发布依赖解析器（F383 Item 1 fail-closed）。
 *
 * 单一职责：从已校验服务集合 + 它们各自 deployConfig 声明的出向边，组装 builder
 * 需要的跨服务依赖边，并把所有非法/缺字段/冲突/未选/不存在/跨域/自依赖的情况
 * 升级为 HTTP 400 阻断 preview/create。preview/create 共用本方法（Item 1 §4 一致性）。
 *
 * 与 ReleasePlanAccessService 的职责切分：
 * - ReleasePlanAccessService.assertAndResolve：命令字段 + 环境/服务器归属校验。
 * - 本服务.resolveDependencies：跨服务依赖边解析 + fail-closed DB 探测。
 *
 * Item 1 fail-closed 语义（详见 release-service-deps.utils.ts 与 release-dep-error.utils.ts）：
 * - parser 级错误 → 批量 400。
 * - 自依赖 → 400 RELEASE_DEP_SELF_DEPENDENCY。
 * - 下游不在本计划：required → 400 RELEASE_DEP_TARGET_NOT_SELECTED；
 *   optional → 记 warning 并丢弃（不阻断）。
 * - 区分 未选/不存在/跨域：同 scope 探测 + 无 scope 探测。
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  readServiceReleaseDependencies,
  type DeclaredServiceDependencyEdge,
} from "./utils/release-service-deps.utils";
import type { ServiceDependencyEdge } from "./utils/release-cross-service-edges.utils";
import type { ResolvedReleaseService } from "./release-plan-access.service";
import {
  releaseDepErrorsToException,
  type ReleaseDepError,
  type ReleaseDepParseError,
} from "./utils/release-dep-error.utils";
import { describeReleaseDepError } from "./utils/release-dep-copy.utils";

@Injectable()
export class ReleaseDependencyResolverService {
  private static readonly logger = new Logger(ReleaseDependencyResolverService.name);
  constructor(private readonly prisma: PrismaService) {}

  async resolveDependencies(
    teamId: string,
    projectId: string,
    environmentId: string,
    services: ResolvedReleaseService[],
  ): Promise<ServiceDependencyEdge[]> {
    const selectedIds = new Set(services.map((s) => s.applicationServiceId));
    if (selectedIds.size === 0) return [];
    const rows = await this.prisma.applicationService.findMany({
      where: { id: { in: [...selectedIds] }, teamId, projectId, environmentId },
      select: { id: true, deployConfig: true },
    });
    const configById = new Map(rows.map((r) => [r.id, r.deployConfig]));
    const errors: ReleaseDepError[] = [];
    const warnings: string[] = [];
    const out: ServiceDependencyEdge[] = [];

    // 第一遍：解析声明边，收集 parser 级错误；保留原始顺序用于 dependencyIndex。
    const parsedBySvc: { svc: ResolvedReleaseService; edges: DeclaredServiceDependencyEdge[] }[] =
      [];
    for (const svc of services) {
      const cfg = configById.get(svc.applicationServiceId);
      const parsed = readServiceReleaseDependencies(cfg);
      for (const e of parsed.errors) errors.push(this.stamp(e, svc));
      parsedBySvc.push({ svc, edges: parsed.edges });
    }

    // 第二遍：对所有「未选 toServiceId」做两次批量探测（同 scope / 同 tenant 无 scope）。
    // CR B3：无 scope 探测必须带 teamId——否则变成跨租户 service-id 存在性预言机
    //（同 tenant 但跨 project/env 才是唯一能真正满足发布约束的 cross-scope 情况）。
    const probeIds = new Set<string>();
    for (const { svc, edges } of parsedBySvc) {
      for (const edge of edges) {
        if (edge.toServiceId === svc.applicationServiceId) continue;
        if (!selectedIds.has(edge.toServiceId)) probeIds.add(edge.toServiceId);
      }
    }
    const sameScopeById = new Set<string>();
    const anyScopeRows = new Map<
      string,
      { teamId: string; projectId: string; environmentId: string }
    >();
    if (probeIds.size > 0) {
      const sameScope = await this.prisma.applicationService.findMany({
        where: { id: { in: [...probeIds] }, teamId, projectId, environmentId },
        select: { id: true },
      });
      for (const r of sameScope) sameScopeById.add(r.id);
      const stillMissing = [...probeIds].filter((id) => !sameScopeById.has(id));
      if (stillMissing.length > 0) {
        const anyScope = await this.prisma.applicationService.findMany({
          where: { id: { in: stillMissing }, teamId },
          select: { id: true, teamId: true, projectId: true, environmentId: true },
        });
        for (const r of anyScope) anyScopeRows.set(r.id, r);
      }
    }

    // 第三遍：翻译为 errors（required/optional 分流）或 warnings，并收集有效边。
    // CR B1：dependencyIndex 用 edge.sourceIndex（parser 锚定的合并数组下标），
    // 与 parser errors 同源，确保一条响应里多个错误的下标对齐用户配置里的真实位置。
    // CR B2：optional 依赖对未选/不存在/跨域一律 warn+drop（不阻断）；required 才 400。
    for (const { svc, edges } of parsedBySvc) {
      for (const edge of edges) {
        if (edge.toServiceId === svc.applicationServiceId) {
          errors.push({
            code: "RELEASE_DEP_SELF_DEPENDENCY",
            applicationServiceId: svc.applicationServiceId,
            serviceName: svc.serviceName,
            dependencyIndex: edge.sourceIndex,
            toServiceId: edge.toServiceId,
            reason: "dependency points to the owning service itself",
            suggestedAction: `服务「${svc.serviceName}」的发布依赖指向自身，请到服务部署配置中修正`,
          });
          continue;
        }
        if (selectedIds.has(edge.toServiceId)) {
          out.push({
            fromServiceId: svc.applicationServiceId,
            fromStageType: edge.fromStageType,
            toServiceId: edge.toServiceId,
            toStageType: edge.toStageType,
            conditionType: edge.conditionType,
            required: edge.required,
          });
          continue;
        }
        const required = edge.required ?? true;
        const isSameScope = sameScopeById.has(edge.toServiceId);
        const anyRow = anyScopeRows.get(edge.toServiceId);
        const code = isSameScope
          ? ("RELEASE_DEP_TARGET_NOT_SELECTED" as const)
          : anyRow
            ? ("RELEASE_DEP_CROSS_SCOPE" as const)
            : ("RELEASE_DEP_TARGET_NOT_FOUND" as const);
        const copy = describeReleaseDepError(code, {
          serviceName: svc.serviceName,
          toServiceId: edge.toServiceId,
          anyRow,
          expectedProjectId: projectId,
          expectedEnvironmentId: environmentId,
        });
        if (!required) {
          warnings.push(copy.suggestedAction);
          continue;
        }
        errors.push({
          code,
          applicationServiceId: svc.applicationServiceId,
          serviceName: svc.serviceName,
          dependencyIndex: edge.sourceIndex,
          toServiceId: edge.toServiceId,
          reason: copy.reason,
          suggestedAction: copy.suggestedAction,
        });
      }
    }

    if (warnings.length > 0) {
      ReleaseDependencyResolverService.logger.warn(
        `release-dep optional target not selected (downgraded to warning):\n${warnings.join("\n")}`,
      );
    }
    if (errors.length > 0) throw releaseDepErrorsToException(errors);
    return out;
  }

  private stamp(e: ReleaseDepParseError, svc: ResolvedReleaseService): ReleaseDepError {
    return {
      ...e,
      applicationServiceId: svc.applicationServiceId,
      serviceName: svc.serviceName,
    };
  }
}
