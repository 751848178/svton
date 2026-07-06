import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { alertSilenceSelect } from "./monitoring-alert-silence.constants";
import type {
  AlertSilenceRecord,
  AlertSilenceRuleTarget,
} from "./monitoring-alert-silence.types";

@Injectable()
export class MonitoringAlertSilenceMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatchingSilence(
    teamId: string,
    rule: AlertSilenceRuleTarget,
    eventStatus: string,
  ): Promise<AlertSilenceRecord | null> {
    if (!["firing", "error", "insufficient_data"].includes(eventStatus)) {
      return null;
    }

    const now = new Date();
    const silences = await this.prisma.alertSilence.findMany({
      where: {
        teamId,
        status: "active",
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: alertSilenceSelect,
    });

    return (
      silences
        .filter((silence) => this.matchesRule(silence, rule))
        .sort(
          (left, right) =>
            this.specificity(right) - this.specificity(left) ||
            this.endTime(left) - this.endTime(right),
        )[0] || null
    );
  }

  buildEventMetadata(
    metadata: Record<string, unknown> | undefined,
    silence: AlertSilenceRecord | null,
  ) {
    if (!silence) return metadata;

    return {
      ...(metadata || {}),
      silence: {
        id: silence.id,
        name: silence.name,
        reason: silence.reason,
        startsAt: silence.startsAt.toISOString(),
        endsAt: silence.endsAt ? silence.endsAt.toISOString() : null,
      },
    };
  }

  private matchesRule(
    silence: AlertSilenceRecord,
    rule: AlertSilenceRuleTarget,
  ) {
    if (silence.projectId && silence.projectId !== rule.projectId) return false;
    if (silence.environmentId && silence.environmentId !== rule.environmentId) {
      return false;
    }
    if (silence.category && silence.category !== rule.category) return false;
    if (silence.metric && silence.metric !== rule.metric) return false;

    const severities = this.readStringArray(silence.severityFilter);
    return severities.length === 0 || severities.includes(rule.severity);
  }

  private specificity(silence: AlertSilenceRecord) {
    return (
      (silence.environmentId ? 16 : 0) +
      (silence.projectId ? 8 : 0) +
      (silence.metric ? 4 : 0) +
      (silence.category ? 2 : 0) +
      (this.readStringArray(silence.severityFilter).length > 0 ? 1 : 0)
    );
  }

  private endTime(silence: AlertSilenceRecord) {
    return silence.endsAt ? silence.endsAt.getTime() : Number.MAX_SAFE_INTEGER;
  }

  private readStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
  }
}
