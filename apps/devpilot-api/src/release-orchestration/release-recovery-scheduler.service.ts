/**
 * 发布恢复调度器（F383 P0-2/D11 Slice 5）：周期性扫描非终态发布计划并调用
 * ReleaseCoordinatorService.advancePlan，使“完成但无回调 / 排队无回声 / 租约过期”
 * 的阶段也能被自动推进，不依赖用户点击或 SEJ 完成回调。
 *
 * 继承 BaseIntervalScheduler（与 11 个现有调度器一致）：onModuleInit 自动注册
 * interval，重入由基类 tryAcquireRunLock 保护。@Optional SchedulerRegistry 使单测
 * 可直接 new 并调用 runOnce 而不触发定时注册。
 *
 * Env 网关：DEVPILOT_RELEASE_ORCHESTRATION_ENABLED（flag 总开关）AND
 * DEVPILOT_RELEASE_RECOVERY_SCHEDULER_ENABLED（默认 true）。
 */
import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { BaseIntervalScheduler } from "../common/scheduler/base-interval-scheduler";
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import { ReleasePlanRepository } from "./repository/release-plan.repository";

export type ReleaseRecoverySummary = {
  skipped: boolean;
  scanned?: number;
};

@Injectable()
export class ReleaseRecoverySchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(ReleaseRecoverySchedulerService.name);

  constructor(
    private readonly coordinator: ReleaseCoordinatorService,
    private readonly planRepo: ReleasePlanRepository,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return "release-recovery";
  }

  isEnabled(): boolean {
    return (
      this.configService.get("DEVPILOT_RELEASE_ORCHESTRATION_ENABLED", "false") === "true" &&
      this.configService.get("DEVPILOT_RELEASE_RECOVERY_SCHEDULER_ENABLED", "true") === "true"
    );
  }

  intervalMs(): number {
    const seconds = Number(
      this.configService.get("DEVPILOT_RELEASE_RECOVERY_SCHEDULER_INTERVAL_SECONDS", "30"),
    );
    const safeSeconds = Number.isFinite(seconds) && seconds >= 10 ? seconds : 30;
    return safeSeconds * 1000;
  }

  async runOnce(): Promise<ReleaseRecoverySummary> {
    if (!this.isEnabled() || !this.tryAcquireRunLock()) {
      return { skipped: true };
    }
    try {
      const plans = await this.planRepo.listNonTerminal();
      for (const plan of plans) {
        try {
          await this.coordinator.advancePlan(plan.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`recovery advance failed for ${plan.id}: ${msg}`);
        }
      }
      return { skipped: false, scanned: plans.length };
    } finally {
      this.releaseRunLock();
    }
  }
}
