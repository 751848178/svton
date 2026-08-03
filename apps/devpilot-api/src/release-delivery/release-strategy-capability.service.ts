import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import type {
  ReleaseStrategy,
  ReleaseStrategyCapability,
} from "./release-strategy-capability.types";

const MISSING_ADVANCED_CAPABILITIES = [
  "real_traffic_provider",
  "candidate_and_stable_workloads",
  "metric_analysis_provider",
  "pause_and_abort_provider",
  "automatic_rollback_provider",
] as const;

const REASONS: Record<ReleaseStrategy, string> = {
  standard: "标准发布使用已冻结制品、配置、审批与部署执行链路",
  canary: "金丝雀发布缺少真实流量、候选工作负载、指标分析、暂停/终止与自动回滚能力",
  blue_green: "蓝绿发布缺少双工作负载、真实流量切换、指标分析、暂停/终止与自动回滚能力",
  automatic_traffic: "自动放量缺少真实流量、指标分析、暂停/终止与自动回滚能力",
};

@Injectable()
export class ReleaseStrategyCapabilityService {
  list(): ReleaseStrategyCapability[] {
    return (Object.keys(REASONS) as ReleaseStrategy[]).map((strategy) =>
      this.get(strategy),
    );
  }

  get(strategy: ReleaseStrategy): ReleaseStrategyCapability {
    const executable = strategy === "standard";
    return {
      strategy,
      executable,
      reasonCode: executable
        ? "standard_release_available"
        : "release_strategy_capabilities_unavailable",
      reason: REASONS[strategy],
      missingCapabilities: executable
        ? []
        : [...MISSING_ADVANCED_CAPABILITIES],
    };
  }

  requireExecutable(strategy: ReleaseStrategy) {
    const capability = this.get(strategy);
    if (capability.executable) return capability;
    throw new UnprocessableEntityException({
      code: capability.reasonCode,
      message: capability.reason,
      strategy,
      missingCapabilities: capability.missingCapabilities,
    });
  }
}

