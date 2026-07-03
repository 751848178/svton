import { Injectable } from "@nestjs/common";
import { MonitoringServiceSloDashboardStatusService } from "./monitoring-service-slo-dashboard-status.service";
import type {
  ServiceSloAlertEvent,
  ServiceSloDashboardRow,
  ServiceSloDeploymentRun,
  ServiceSloOperationRun,
  ServiceSloServiceRecord,
} from "./monitoring-service-slo-dashboard.types";

@Injectable()
export class MonitoringServiceSloDashboardBuilderService {
  constructor(
    private readonly statusService: MonitoringServiceSloDashboardStatusService,
  ) {}

  buildRows(
    services: ServiceSloServiceRecord[],
    deploymentRuns: ServiceSloDeploymentRun[],
    operationRuns: ServiceSloOperationRun[],
    alertEvents: ServiceSloAlertEvent[],
    targetPercent = 99,
  ): ServiceSloDashboardRow[] {
    const deploymentsByService = this.groupByServiceId(deploymentRuns);
    const operationsByService = this.groupByServiceId(operationRuns);
    const alertsByService = this.groupByServiceId(alertEvents);

    return services
      .map((service) =>
        this.buildRow(
          service,
          deploymentsByService.get(service.id) || [],
          operationsByService.get(service.id) || [],
          alertsByService.get(service.id) || [],
          targetPercent,
        ),
      )
      .sort((left, right) => this.compareRows(left, right));
  }

  summarize(
    rows: ServiceSloDashboardRow[],
    windowMinutes = 1440,
    targetPercent = 99,
    generatedAt = new Date(),
  ) {
    const rowsWithSlo = rows.filter((row) => row.sloPercent !== null);
    const averageSloPercent =
      rowsWithSlo.length > 0
        ? rowsWithSlo.reduce((sum, row) => sum + (row.sloPercent || 0), 0) /
          rowsWithSlo.length
        : null;

    return {
      generatedAt,
      windowMinutes,
      targetPercent,
      serviceCount: rows.length,
      okCount: rows.filter((row) => row.status === "ok").length,
      warningCount: rows.filter((row) => row.status === "warning").length,
      criticalCount: rows.filter((row) => row.status === "critical").length,
      noDataCount: rows.filter((row) => row.status === "no_data").length,
      averageSloPercent: this.statusService.roundPercent(averageSloPercent),
      deploymentCount: rows.reduce((sum, row) => sum + row.deploymentCount, 0),
      deploymentFailureCount: rows.reduce(
        (sum, row) => sum + row.deploymentFailureCount,
        0,
      ),
      operationCount: rows.reduce((sum, row) => sum + row.operationCount, 0),
      operationFailureCount: rows.reduce(
        (sum, row) => sum + row.operationFailureCount,
        0,
      ),
      alertImpactCount: rows.reduce(
        (sum, row) => sum + row.alertImpactCount,
        0,
      ),
      criticalAlertCount: rows.reduce(
        (sum, row) => sum + row.criticalAlertCount,
        0,
      ),
      rows,
    };
  }

  private buildRow(
    service: ServiceSloServiceRecord,
    serviceDeployments: ServiceSloDeploymentRun[],
    serviceOperations: ServiceSloOperationRun[],
    serviceAlerts: ServiceSloAlertEvent[],
    targetPercent: number,
  ): ServiceSloDashboardRow {
    const deploymentSuccessCount = serviceDeployments.filter(
      (run) => run.status === "completed",
    ).length;
    const deploymentFailureCount = serviceDeployments.filter((run) =>
      this.statusService.isFailureStatus(run.status),
    ).length;
    const operationSuccessCount = serviceOperations.filter(
      (run) => run.status === "completed",
    ).length;
    const operationFailureCount = serviceOperations.filter((run) =>
      this.statusService.isFailureStatus(run.status),
    ).length;
    const alertImpactCount = serviceAlerts.filter((event) =>
      ["firing", "error", "suppressed"].includes(event.status),
    ).length;
    const criticalAlertCount = serviceAlerts.filter(
      (event) => event.severity === "critical",
    ).length;
    const goodSignals = deploymentSuccessCount + operationSuccessCount;
    const badSignals =
      deploymentFailureCount + operationFailureCount + alertImpactCount;
    const totalSignals = goodSignals + badSignals;
    const sloPercent =
      totalSignals > 0 ? (goodSignals / totalSignals) * 100 : null;
    const allowedFailureRate = Math.max(0.01, 100 - targetPercent);
    const observedFailureRate = sloPercent === null ? null : 100 - sloPercent;
    const burnRate =
      observedFailureRate === null
        ? null
        : observedFailureRate / allowedFailureRate;
    const errorBudgetRemainingPercent =
      observedFailureRate === null
        ? null
        : ((allowedFailureRate - observedFailureRate) / allowedFailureRate) *
          100;
    const status = this.statusService.dashboardStatus(
      sloPercent,
      targetPercent,
      errorBudgetRemainingPercent,
      criticalAlertCount,
      alertImpactCount,
    );

    return {
      id: service.id,
      serviceId: service.id,
      projectId: service.projectId,
      environmentId: service.environmentId,
      applicationId: service.applicationId,
      status: status.status,
      statusReason: status.reason,
      targetPercent,
      sloPercent: this.statusService.roundPercent(sloPercent),
      errorBudgetRemainingPercent: this.statusService.roundPercent(
        errorBudgetRemainingPercent,
      ),
      burnRate: burnRate === null ? null : Number(burnRate.toFixed(2)),
      deploymentCount: serviceDeployments.length,
      deploymentSuccessCount,
      deploymentFailureCount,
      operationCount: serviceOperations.length,
      operationSuccessCount,
      operationFailureCount,
      alertImpactCount,
      criticalAlertCount,
      service,
    };
  }

  private compareRows(
    left: ServiceSloDashboardRow,
    right: ServiceSloDashboardRow,
  ) {
    return (
      this.statusService.statusRank(right.status) -
        this.statusService.statusRank(left.status) ||
      (left.sloPercent ?? 101) - (right.sloPercent ?? 101) ||
      right.alertImpactCount - left.alertImpactCount ||
      right.deploymentFailureCount - left.deploymentFailureCount ||
      right.operationFailureCount - left.operationFailureCount
    );
  }

  private groupByServiceId<T extends { applicationServiceId?: string | null }>(
    items: T[],
  ) {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      if (!item.applicationServiceId) continue;
      groups.set(item.applicationServiceId, [
        ...(groups.get(item.applicationServiceId) || []),
        item,
      ]);
    }
    return groups;
  }
}
