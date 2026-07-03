import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import type {
  MonitoringAuthRequest,
  ReadableMonitoringRecord,
} from "./monitoring-access.types";

@Injectable()
export class MonitoringAccessService {
  constructor(
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  assertCanWriteMonitoring(
    req: MonitoringAuthRequest,
    action: string,
    targetId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = "medium",
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: "monitoring",
      action,
      targetType: this.monitoringTargetType(action),
      targetId,
      risk,
    });
  }

  async filterReadableMonitoringRecords<T extends ReadableMonitoringRecord>(
    req: MonitoringAuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(
      records.map(async (record) => ({
        record,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId:
            record.projectId ??
            record.rule?.projectId ??
            record.channel?.projectId ??
            record.alertEvent?.projectId ??
            null,
          environmentId:
            record.environmentId ??
            record.rule?.environmentId ??
            record.channel?.environmentId ??
            record.alertEvent?.environmentId ??
            null,
          category: "monitoring",
          action,
          targetType,
          targetId: record.id,
          risk: "low",
        }),
      })),
    );

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }

  private monitoringTargetType(action: string) {
    if (action.startsWith("monitoring.event.")) return "alert_event";
    if (action.startsWith("monitoring.silence.")) return "alert_silence";
    if (action.startsWith("monitoring.notification_channel.")) {
      return "alert_notification_channel";
    }
    if (action.startsWith("monitoring.notification_delivery.")) {
      return "alert_notification_delivery";
    }
    return "alert_rule";
  }
}
