import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import {
  asRecord,
  readString,
} from "./monitoring-alert-evaluation-value.utils";
import type { CloudSyncFailureSample } from "./monitoring-alert-cloud-provider-sync.types";
import {
  createFailureSample,
  isCloudSyncRunInRuleScope,
  isConfigFallback,
  isLiveProviderFailure,
  providerMatches,
  readProviderDiagnostics,
} from "./monitoring-alert-cloud-provider-sync.utils";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertCloudProviderSyncEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly result: MonitoringAlertEvaluationResultService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    const condition = asRecord(rule.condition);
    const provider = readString(condition.provider);
    const windowRuns = readPositiveInt(condition.windowRuns, 5, 1, 20);
    const failureThreshold = readPositiveInt(
      condition.failureThreshold,
      2,
      1,
      windowRuns,
    );
    const includeConfigFallback = condition.includeConfigFallback === true;
    const queryTake = Math.min(Math.max(windowRuns * 10, 20), 100);
    const runs = await this.prisma.resourceSyncRun.findMany({
      where: {
        teamId: rule.teamId,
        sourceType: "cloud",
        provider:
          provider && provider !== "all"
            ? { in: [provider, "all"] }
            : undefined,
      },
      orderBy: { startedAt: "desc" },
      take: queryTake,
      select: {
        id: true,
        provider: true,
        status: true,
        error: true,
        discovered: true,
        metadata: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    const scopedRuns = runs
      .filter((run) => isCloudSyncRunInRuleScope(rule, asRecord(run.metadata)))
      .slice(0, windowRuns);

    if (!scopedRuns.length) {
      return this.result.insufficient(rule, "没有可评估的云资源同步记录", {
        provider: provider || "all",
        windowRuns,
        failureThreshold,
      });
    }

    const providerFailures: CloudSyncFailureSample[] = [];
    const configFallbacks: CloudSyncFailureSample[] = [];
    const latestRuns = scopedRuns.map((run) => {
      const metadata = asRecord(run.metadata);
      const providerDiagnostics = readProviderDiagnostics(
        metadata.providers,
      ).filter((diagnostic) => providerMatches(provider, diagnostic.provider));

      if (run.status === "failed") {
        providerFailures.push({
          runId: run.id,
          provider: provider && provider !== "all" ? provider : run.provider,
          status: run.status,
          reason: run.error || "cloud sync failed",
          startedAt: run.startedAt,
        });
      }

      providerDiagnostics.forEach((diagnostic) => {
        const sample = createFailureSample(run, diagnostic);
        if (isLiveProviderFailure(diagnostic)) {
          providerFailures.push(sample);
        } else if (isConfigFallback(diagnostic)) {
          if (includeConfigFallback) providerFailures.push(sample);
          else configFallbacks.push(sample);
        }
      });

      return {
        id: run.id,
        provider: run.provider,
        status: run.status,
        discovered: run.discovered,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        providerDiagnostics: providerDiagnostics.map((diagnostic) => ({
          provider: diagnostic.provider,
          live: diagnostic.live,
          syncMode: diagnostic.syncMode,
          fallbackReason: diagnostic.fallbackReason,
          errorCount: diagnostic.errors.length,
        })),
      };
    });
    const value = {
      provider: provider || "all",
      windowRuns,
      failureThreshold,
      includeConfigFallback,
      evaluatedRuns: scopedRuns.length,
      failureCount: providerFailures.length,
      configFallbackCount: configFallbacks.length,
      failures: providerFailures.slice(0, 5),
      configFallbacks: configFallbacks.slice(0, 5),
      latestRuns,
    };

    if (providerFailures.length >= failureThreshold) {
      return this.result.firing(
        rule,
        `最近 ${scopedRuns.length} 次云同步中有 ${providerFailures.length} 次 provider 失败，达到阈值 ${failureThreshold}`,
        value,
      );
    }

    if (providerFailures.length > 0) {
      return this.result.ok(
        rule,
        `最近云同步有 ${providerFailures.length} 次 provider 失败，未达到阈值 ${failureThreshold}`,
        value,
      );
    }

    if (configFallbacks.length > 0) {
      return this.result.ok(
        rule,
        `最近云同步没有 provider 失败，但有 ${configFallbacks.length} 次配置 fallback`,
        value,
      );
    }

    return this.result.ok(rule, "最近云资源同步 provider 状态正常", value);
  }
}
