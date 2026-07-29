/**
 * F383 发布初始化证据桥接服务。
 *
 * 单一职责：
 *  1. record() — 发布 bootstrap 阶段成功后，把初始化证据（父级 plan/stage/attempt/job
 *     引用 + 命令指纹）落库为一次已完成的初始化检查点，并写入可审计父子关联。
 *  2. verify() — releaseApplicationOnly 部署运行发起时，从数据库重新读取并严格校验证据：
 *     scope（team/project/env/service）、fingerprint、阶段类型、attempt 成功状态全部匹配
 *     才返回 verified；否则 fail-closed 返回 mismatch。绝不信任调用方传入的引用本身。
 *
 * 不硬编码成功、不直接改状态字段：record 只写「bootstrap 已成功」这一客观事实对应的
 * completed 检查点；verify 只读 + 校验，不做任何放行推断。
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { deploymentInitializationFingerprint } from "./deployment-initialization-checkpoint.service";
import type {
  ReleaseInitializationEvidenceRef,
  ReleaseInitializationEvidenceVerification,
  VerifiedReleaseInitializationRow,
  EvidenceScopeInput,
} from "./release-initialization-evidence.types";

@Injectable()
export class ReleaseInitializationEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 发布 bootstrap 阶段成功后记录初始化证据。
   * 幂等：同一 (service, env, fingerprint) 已存在 completed 则只补全父级引用。
   * 父子关联（releasePlanId/releaseStageId/releaseStageAttemptId/serverExecutionJobId）
   * 写入检查点行，供审计与 verify 回读。
   */
  async record(ref: ReleaseInitializationEvidenceRef): Promise<string> {
    const scope = this.scopeWhere(ref);
    const existing = await this.prisma.applicationServiceInitialization.findUnique({
      where: {
        applicationServiceId_environmentId_commandFingerprint: scope,
      },
    });
    const parentLink = {
      releasePlanId: ref.releasePlanId,
      releaseStageId: ref.releaseStageId,
      releaseStageAttemptId: ref.releaseStageAttemptId,
      serverExecutionJobId: ref.serverExecutionJobId,
      releaseEvidenceStatus: "verified" as const,
    };
    if (existing) {
      const updated = await this.prisma.applicationServiceInitialization.update({
        where: { id: existing.id },
        data: {
          status: "completed",
          error: null,
          finishedAt: existing.finishedAt ?? new Date(),
          ...parentLink,
        },
      });
      return updated.id;
    }
    const created = await this.prisma.applicationServiceInitialization.create({
      data: {
        teamId: ref.teamId,
        projectId: ref.projectId,
        environmentId: ref.environmentId,
        applicationServiceId: ref.applicationServiceId,
        commandFingerprint: ref.commandFingerprint,
        status: "completed",
        finishedAt: new Date(),
        ...parentLink,
      },
    });
    return created.id;
  }

  /**
   * 严格校验发布初始化证据（fail-closed）。
   * 从数据库重新读取检查点行 + 关联 attempt，逐项比对：
   *   - 检查点 scope 与请求 scope 一致
   *   - commandFingerprint 与请求指纹一致
   *   - 检查点 status === completed
   *   - 父级 attempt 存在且 status === succeeded
   * 任何不匹配返回 mismatch，不返回 verified。
   */
  async verify(
    scope: EvidenceScopeInput,
    ref: ReleaseInitializationEvidenceRef,
  ): Promise<ReleaseInitializationEvidenceVerification> {
    const row = await this.readRow(scope);
    if (!row) {
      return { status: "mismatch", reason: "初始化证据检查点不存在" };
    }
    const scopeCheck = this.assertScope(row, scope);
    if (scopeCheck) return scopeCheck;
    if (row.commandFingerprint !== ref.commandFingerprint) {
      return { status: "mismatch", reason: "初始化命令指纹不匹配" };
    }
    if (row.status !== "completed") {
      return { status: "mismatch", reason: `检查点未完成（status=${row.status}）` };
    }
    if (row.releaseStageAttemptId !== ref.releaseStageAttemptId) {
      return { status: "mismatch", reason: "父级发布阶段 attempt 引用不一致" };
    }
    const attempt = row.releaseStageAttemptId
      ? await this.prisma.releaseStageAttempt.findUnique({
          where: { id: row.releaseStageAttemptId },
          select: { id: true, status: true, releaseStageId: true },
        })
      : null;
    if (!attempt || attempt.status !== "succeeded") {
      return { status: "mismatch", reason: "父级发布 bootstrap attempt 未成功" };
    }
    if (row.releaseStageId && attempt.releaseStageId !== row.releaseStageId) {
      return { status: "mismatch", reason: "父级发布阶段引用不一致" };
    }
    return { status: "verified", checkpointId: row.id };
  }

  private async readRow(scope: EvidenceScopeInput): Promise<VerifiedReleaseInitializationRow | null> {
    const row = await this.prisma.applicationServiceInitialization.findUnique({
      where: {
        applicationServiceId_environmentId_commandFingerprint: {
          applicationServiceId: scope.applicationServiceId,
          environmentId: scope.environmentId,
          commandFingerprint: scope.commandFingerprint,
        },
      },
    });
    return row as VerifiedReleaseInitializationRow | null;
  }

  private assertScope(
    row: VerifiedReleaseInitializationRow,
    scope: EvidenceScopeInput,
  ): ReleaseInitializationEvidenceVerification | null {
    const fields: Array<[keyof EvidenceScopeInput, string]> = [
      ["teamId", "team"],
      ["projectId", "project"],
      ["environmentId", "environment"],
      ["applicationServiceId", "applicationService"],
      ["commandFingerprint", "fingerprint"],
    ];
    for (const [key, label] of fields) {
      if (row[key] !== scope[key]) {
        return { status: "mismatch", reason: `${label} scope 不匹配` };
      }
    }
    return null;
  }

  private scopeWhere(ref: ReleaseInitializationEvidenceRef) {
    return {
      applicationServiceId: ref.applicationServiceId,
      environmentId: ref.environmentId,
      commandFingerprint: ref.commandFingerprint,
    } satisfies Prisma.ApplicationServiceInitializationApplicationServiceIdEnvironmentIdCommandFingerprintCompoundUniqueInput;
  }
}

export { deploymentInitializationFingerprint };
