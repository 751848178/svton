import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import {
  asRecord,
  isFailureStatus,
  readBoolean,
  readString,
} from "./monitoring-alert-evaluation-value.utils";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import type { DeploymentSmokeCheckRunRecord } from "./monitoring-alert-smoke-check.types";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertDeploymentSmokeCheckEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly result: MonitoringAlertEvaluationResultService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    if (!rule.projectId) {
      return this.result.insufficient(rule, "规则未绑定项目部署目标", {});
    }

    const condition = asRecord(rule.condition);
    const windowRuns = readPositiveInt(condition.windowRuns, 3, 1, 20);
    const failureThreshold = readPositiveInt(
      condition.failureThreshold,
      1,
      1,
      windowRuns,
    );
    const includeDryRun = readBoolean(condition.includeDryRun) === true;
    const runs = await this.prisma.deploymentRun.findMany({
      where: {
        teamId: rule.teamId,
        projectId: rule.projectId,
        environmentId: rule.environmentId ?? undefined,
        applicationId: rule.applicationId ?? undefined,
        applicationServiceId: rule.applicationServiceId ?? undefined,
        mode: "smoke_check",
        dryRun: includeDryRun ? undefined : false,
      },
      orderBy: { startedAt: "desc" },
      take: windowRuns,
      select: {
        id: true,
        status: true,
        dryRun: true,
        source: true,
        trigger: true,
        sourceRunId: true,
        serverExecutionJobId: true,
        healthCheckUrl: true,
        startedAt: true,
        finishedAt: true,
        error: true,
        result: true,
      },
    });
    const completedRuns = runs.filter(
      (run) => run.status === "completed" || isFailureStatus(run.status),
    );
    const failedRuns = completedRuns.filter((run) =>
      isFailureStatus(run.status),
    );
    const projectName = rule.project?.name || "项目部署";
    const value = {
      projectId: rule.projectId,
      projectName,
      environmentId: rule.environmentId,
      applicationId: rule.applicationId,
      applicationServiceId: rule.applicationServiceId,
      windowRuns,
      failureThreshold,
      includeDryRun,
      runCount: runs.length,
      completedRunCount: completedRuns.length,
      failureCount: failedRuns.length,
      latestRuns: runs.map((run) => serializeDeploymentSmokeCheckRun(run)),
    };

    if (!runs.length) {
      return this.result.insufficient(
        rule,
        `${projectName} 暂无部署 Smoke 检查记录`,
        value,
      );
    }

    if (!completedRuns.length) {
      return this.result.insufficient(
        rule,
        `${projectName} 最近部署 Smoke 检查仍未结束`,
        value,
      );
    }

    if (failedRuns.length >= failureThreshold) {
      const latestFailure = failedRuns[0];
      return this.result.firing(
        rule,
        `${projectName} 最近 ${completedRuns.length} 次部署 Smoke 检查失败 ${failedRuns.length} 次` +
          `${latestFailure.error ? `: ${latestFailure.error}` : ""}`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `${projectName} 最近 ${completedRuns.length} 次部署 Smoke 检查未达到失败阈值`,
      value,
    );
  }
}

function serializeDeploymentSmokeCheckRun(run: DeploymentSmokeCheckRunRecord) {
  const result = asRecord(run.result);
  return {
    id: run.id,
    status: run.status,
    dryRun: run.dryRun,
    source: run.source,
    trigger: run.trigger,
    sourceRunId: run.sourceRunId,
    serverExecutionJobId: run.serverExecutionJobId,
    healthCheckUrl: run.healthCheckUrl,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() || null,
    error: run.error,
    resultStatus: readString(result.status) || null,
    resultSummary:
      readString(result.summary) || readString(result.message) || null,
  };
}
