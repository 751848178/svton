/**
 * 发布协调器端口（F383 D3）：把 ServerExecutor 完成回调对"如何收尾发布阶段"
 * 的依赖收敛成接口，避免 ServerExecutorModule ↔ ReleaseOrchestrationModule
 * 的运行时循环依赖。
 *
 * 模式对齐 JOB_QUEUE_PORT（`server-executor/queue/job-queue.port.ts`）：
 *  - ReleaseOrchestrationModule 在 providers 里 `{ provide: RELEASE_COORDINATOR_PORT,
 *    useExisting: ReleaseCoordinatorService }`，并 export ReleaseCoordinatorService。
 *  - ServerExecutorService `@Optional() @Inject(RELEASE_COORDINATOR_PORT)`，flag 关闭
 *    或未引入该模块时为 undefined —— SEJ 完成路径不依赖它。
 *
 * 接口是 Symbol+interface，仅类型导入，无运行时循环。
 */
export const RELEASE_COORDINATOR_PORT = Symbol("RELEASE_COORDINATOR_PORT");

/**
 * 关联运行的终态载荷：mirror ServerExecutionJob / DeploymentRun 完成时携带的
 * `{ status, result, logs, error }` 形状，供协调器解释成 ReleaseStageExecutionResult。
 */
export interface ReleaseCoordinatorTerminal {
  kind: "serverExecutionJob" | "deploymentRun";
  id: string;
  result: {
    status: string;
    result?: unknown;
    logs?: unknown;
    error?: string | null;
  };
}

export interface ReleaseCoordinatorPort {
  /**
   * 收尾指定 attempt 并推进计划（幂等）：
   *  - 重新按 id 读取 attempt；若已终态则直接返回（重复完成回调安全）。
   *  - 解释 terminal.result → ReleaseStageExecutionResult（沿用现有解释器）。
   *  - 调 finishAttempt + advancePlan。
   *  - 任何异常只记 warn，绝不向 SEJ 完成路径抛错。
   */
  finalizeAndAdvance(
    releasePlanId: string,
    stageAttemptId: string,
    terminal: ReleaseCoordinatorTerminal,
  ): Promise<void>;
}
