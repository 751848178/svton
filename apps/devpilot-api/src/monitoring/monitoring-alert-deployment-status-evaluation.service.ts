import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";

@Injectable()
export class MonitoringAlertDeploymentStatusEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly result: MonitoringAlertEvaluationResultService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    const latest = await this.prisma.deploymentRun.findFirst({
      where: {
        teamId: rule.teamId,
        projectId: rule.projectId ?? undefined,
        environmentId: rule.environmentId ?? undefined,
        applicationId: rule.applicationId ?? undefined,
        applicationServiceId: rule.applicationServiceId ?? undefined,
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        source: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        error: true,
      },
    });

    if (!latest) {
      return this.result.insufficient(rule, "没有可评估的部署运行记录", {});
    }

    const value = {
      deploymentRunId: latest.id,
      status: latest.status,
      source: latest.source,
      trigger: latest.trigger,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      error: latest.error,
    };

    if (["failed", "blocked"].includes(latest.status)) {
      return this.result.firing(rule, `最近部署运行 ${latest.status}`, value);
    }

    if (latest.status === "completed") {
      return this.result.ok(rule, "最近部署运行正常", value);
    }

    return this.result.insufficient(
      rule,
      `最近部署运行仍为 ${latest.status}`,
      value,
    );
  }
}
