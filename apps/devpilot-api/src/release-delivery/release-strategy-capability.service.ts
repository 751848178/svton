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

const REASONS: Record<ReleaseStrategy, { zh: string; en: string }> = {
  standard: {
    zh: "标准发布使用已冻结制品、配置、审批与部署执行链路",
    en: "Standard release uses the frozen artifact, configuration, approval and deployment chain",
  },
  canary: {
    zh: "金丝雀发布缺少真实流量、候选工作负载、指标分析、暂停/终止与自动回滚能力",
    en: "Canary release requires real traffic, candidate workloads, metric analysis, pause/abort and automatic rollback providers",
  },
  blue_green: {
    zh: "蓝绿发布缺少双工作负载、真实流量切换、指标分析、暂停/终止与自动回滚能力",
    en: "Blue-green release requires dual workloads, real traffic switching, metric analysis, pause/abort and automatic rollback providers",
  },
  automatic_traffic: {
    zh: "自动放量缺少真实流量、指标分析、暂停/终止与自动回滚能力",
    en: "Automatic traffic ramp requires real traffic, metric analysis, pause/abort and automatic rollback providers",
  },
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
      message: capability.reason.zh,
      reason: capability.reason,
      strategy,
      missingCapabilities: capability.missingCapabilities,
    });
  }
}
