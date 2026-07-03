import { Injectable } from "@nestjs/common";
import type { ServiceSloDashboardStatus } from "./monitoring-service-slo-dashboard.types";

@Injectable()
export class MonitoringServiceSloDashboardStatusService {
  isFailureStatus(status: string) {
    return ["failed", "blocked", "error", "cancelled"].includes(status);
  }

  dashboardStatus(
    sloPercent: number | null,
    targetPercent: number,
    errorBudgetRemainingPercent: number | null,
    criticalAlertCount: number,
    alertImpactCount: number,
  ): { status: ServiceSloDashboardStatus; reason: string } {
    if (sloPercent === null) {
      return {
        status: "no_data",
        reason: "窗口内暂无真实部署、服务操作或服务告警信号",
      };
    }
    if (criticalAlertCount > 0 || sloPercent < targetPercent) {
      return {
        status: "critical",
        reason:
          criticalAlertCount > 0
            ? `窗口内有 ${criticalAlertCount} 个严重服务告警`
            : `SLO ${this.formatPercentValue(sloPercent)} 低于目标 ${this.formatPercentValue(targetPercent)}`,
      };
    }
    if ((errorBudgetRemainingPercent ?? 100) < 50 || alertImpactCount > 0) {
      return {
        status: "warning",
        reason:
          alertImpactCount > 0
            ? `窗口内有 ${alertImpactCount} 个服务告警影响`
            : "错误预算剩余低于 50%",
      };
    }
    return {
      status: "ok",
      reason: `SLO 达到 ${this.formatPercentValue(sloPercent)}`,
    };
  }

  statusRank(status: ServiceSloDashboardStatus) {
    const ranks: Record<ServiceSloDashboardStatus, number> = {
      critical: 4,
      warning: 3,
      no_data: 2,
      ok: 1,
    };
    return ranks[status] || 0;
  }

  roundPercent(value: number | null | undefined) {
    return value === null || value === undefined
      ? null
      : Number(value.toFixed(2));
  }

  private formatPercentValue(value: number) {
    return `${this.roundPercent(value)}%`;
  }
}
