/**
 * 发布阶段（release_stage）完成同步服务（F383 P0-2/D3）：把 SEJ 完成/失败
 * 回调映射成对 ReleaseStageAttempt 的回填 + ReleaseCoordinator.finalizeAndAdvance。
 *
 * 结构对齐 ServerExecutorDeploymentRunSyncService：
 *  - syncAfterExecution：成功完成 → 回填 serverExecutionJobId（late binding）→ 调
 *    releaseCoordinator.finalizeAndAdvance（解释 SEJ 终态、收尾 attempt、推进计划）。
 *  - syncAfterFailure：失败 → 同样形状，terminal.result.status="failed"。
 *
 * releaseCoordinator 为可选：flag 关闭或未引入 ReleaseOrchestrationModule 时为
 * undefined，此时仅回填 serverExecutionJobId，不调协调器（绝不抛错阻断 SEJ 完成路径）。
 */
import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseCoordinatorPort } from "../release-orchestration/release-coordinator.port";
import { readOptionalString } from "./server-executor-json.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

export class ServerExecutorReleaseStageRunSyncService {
  private readonly logger = new Logger(ServerExecutorReleaseStageRunSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly releaseCoordinator?: ReleaseCoordinatorPort,
  ) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ): Promise<boolean> {
    const releasePlanId = readOptionalString(metadata.releasePlanId);
    const stageAttemptId = readOptionalString(metadata.stageAttemptId);
    if (!releasePlanId || !stageAttemptId) return false;

    // late binding 回填：仅当 serverExecutionJobId 仍为 null 时写（幂等）
    await this.prisma.releaseStageAttempt.updateMany({
      where: { id: stageAttemptId, serverExecutionJobId: null },
      data: { serverExecutionJobId: jobId },
    });

    if (this.releaseCoordinator) {
      try {
        await this.releaseCoordinator.finalizeAndAdvance(releasePlanId, stageAttemptId, {
          kind: "serverExecutionJob",
          id: jobId,
          result: {
            status: result.status,
            result: result.result,
            logs: result.logs,
            error: result.error ?? null,
          },
        });
      } catch (e) {
        // 永不向 SEJ 完成路径抛错（协调器内部已 try/catch，这里双保险）
        this.logger.warn(`release-stage sync failed for ${stageAttemptId}: ${e}`);
      }
    }
    return true;
  }

  async syncAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const releasePlanId = readOptionalString(metadata.releasePlanId);
    const stageAttemptId = readOptionalString(metadata.stageAttemptId);
    if (!releasePlanId || !stageAttemptId) return;

    await this.prisma.releaseStageAttempt.updateMany({
      where: { id: stageAttemptId, serverExecutionJobId: null },
      data: { serverExecutionJobId: jobId },
    });

    if (this.releaseCoordinator) {
      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : String(error);
      try {
        await this.releaseCoordinator.finalizeAndAdvance(releasePlanId, stageAttemptId, {
          kind: "serverExecutionJob",
          id: jobId,
          result: { status: "failed", error: message },
        });
      } catch (e) {
        this.logger.warn(`release-stage failure sync failed for ${stageAttemptId}: ${e}`);
      }
    }
  }
}
