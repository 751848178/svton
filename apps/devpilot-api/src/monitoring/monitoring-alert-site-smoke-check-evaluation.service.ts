import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import {
  asRecord,
  isFailureStatus,
  readBoolean,
  readString,
  readStringArray,
} from "./monitoring-alert-evaluation-value.utils";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import type { SiteSmokeCheckRunRecord } from "./monitoring-alert-smoke-check.types";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertSiteSmokeCheckEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly result: MonitoringAlertEvaluationResultService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    const site = rule.site;
    if (!site) return this.result.insufficient(rule, "规则未绑定站点目标", {});

    const condition = asRecord(rule.condition);
    const windowRuns = readPositiveInt(condition.windowRuns, 3, 1, 20);
    const failureThreshold = readPositiveInt(
      condition.failureThreshold,
      1,
      1,
      windowRuns,
    );
    const includeDryRun = readBoolean(condition.includeDryRun) === true;
    const runs = await this.prisma.siteSyncRun.findMany({
      where: {
        teamId: rule.teamId,
        siteId: site.id,
        mode: "smoke_check",
        dryRun: includeDryRun ? undefined : false,
      },
      orderBy: { startedAt: "desc" },
      take: windowRuns,
      select: {
        id: true,
        status: true,
        dryRun: true,
        trigger: true,
        targetConfigPath: true,
        serverExecutionJobId: true,
        startedAt: true,
        finishedAt: true,
        error: true,
        result: true,
        warnings: true,
      },
    });
    const completedRuns = runs.filter(
      (run) => run.status === "completed" || isFailureStatus(run.status),
    );
    const failedRuns = completedRuns.filter((run) =>
      isFailureStatus(run.status),
    );
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      windowRuns,
      failureThreshold,
      includeDryRun,
      runCount: runs.length,
      completedRunCount: completedRuns.length,
      failureCount: failedRuns.length,
      latestRuns: runs.map((run) => serializeSiteSmokeCheckRun(run)),
    };

    if (!runs.length) {
      return this.result.insufficient(
        rule,
        `站点 ${site.name} 暂无 Smoke 检查记录`,
        value,
      );
    }

    if (!completedRuns.length) {
      return this.result.insufficient(
        rule,
        `站点 ${site.name} 最近 Smoke 检查仍未结束`,
        value,
      );
    }

    if (failedRuns.length >= failureThreshold) {
      const latestFailure = failedRuns[0];
      return this.result.firing(
        rule,
        `站点 ${site.name} 最近 ${completedRuns.length} 次 Smoke 检查失败 ${failedRuns.length} 次` +
          `${latestFailure.error ? `: ${latestFailure.error}` : ""}`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `站点 ${site.name} 最近 ${completedRuns.length} 次 Smoke 检查未达到失败阈值`,
      value,
    );
  }
}

function serializeSiteSmokeCheckRun(run: SiteSmokeCheckRunRecord) {
  const result = asRecord(run.result);
  const warnings = readStringArray(run.warnings);
  return {
    id: run.id,
    status: run.status,
    dryRun: run.dryRun,
    trigger: run.trigger,
    targetConfigPath: run.targetConfigPath,
    serverExecutionJobId: run.serverExecutionJobId,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() || null,
    error: run.error,
    resultStatus: readString(result.status) || null,
    resultSummary:
      readString(result.summary) || readString(result.message) || null,
    warningCount: warnings.length,
    warnings: warnings.slice(0, 5),
  };
}
