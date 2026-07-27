/**
 * manual_gate 阶段适配器：只由人工审批/确认完成，不创建 shell 任务。
 * 永远返回 awaiting（由 readiness 视为 blocked），直到 approval 被批准。
 */
import { Injectable } from "@nestjs/common";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./release-stage-adapter.types";

@Injectable()
export class ManualGateStageAdapter implements ReleaseStageAdapter {
  readonly kind = "manual_gate";

  async execute(
    _ctx: ReleaseStageExecutionContext,
  ): Promise<ReleaseStageExecutionResult> {
    return {
      status: "queued",
      logSummary: { reason: "等待人工门禁审批" },
    };
  }
}
