import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { alertEventInclude } from './monitoring-alert-event.constants';
import { MonitoringAlertEventAuditService } from './monitoring-alert-event-audit.service';
import type { AlertEventRecord } from './monitoring-alert-event.types';
import type { AlertEvaluationResult } from './monitoring-alert-evaluation.types';
import { alertRuleInclude } from './monitoring-alert-rule.constants';
import type { AlertRuleRecord } from './monitoring-alert-rule.types';
import { MonitoringAlertSilenceService } from './monitoring-alert-silence.service';
import { toJsonValue } from './monitoring-json.utils';
import { MonitoringNotificationDeliveryDispatchService } from './monitoring-notification-delivery-dispatch.service';
import { readPositiveInt } from './monitoring-number.utils';

const dedupeEligibleAlertEventStatuses = ['firing', 'error', 'suppressed'];

@Injectable()
export class MonitoringAlertEvaluationEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertSilenceService: MonitoringAlertSilenceService,
    private readonly alertEventAuditService: MonitoringAlertEventAuditService,
    private readonly notificationDeliveryDispatchService: MonitoringNotificationDeliveryDispatchService,
  ) {}

  async recordDisabledRule(rule: AlertRuleRecord) {
    const disabled = await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastEvaluatedAt: new Date(),
        lastStatus: 'insufficient_data',
        lastMessage: '规则已停用，未执行评估。',
      },
      include: alertRuleInclude,
    });
    return { rule: disabled, event: null };
  }

  async recordEvaluation(
    teamId: string,
    userId: string | null,
    rule: AlertRuleRecord,
    evaluation: AlertEvaluationResult,
  ) {
    const matchedSilence = await this.alertSilenceService.findMatchingSilence(teamId, rule, evaluation.eventStatus);
    const eventStatus = matchedSilence ? 'suppressed' : evaluation.eventStatus;
    const eventSummary = matchedSilence
      ? `${evaluation.summary}（已静默：${matchedSilence.name}）`
      : evaluation.summary;
    const eventMetadata = this.alertSilenceService.buildEventMetadata(evaluation.metadata, matchedSilence);
    const duplicateEvent = await this.findDuplicateAlertEvent(teamId, rule, eventStatus);

    if (duplicateEvent) {
      const updatedRule = await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: {
          lastEvaluatedAt: new Date(),
          lastStatus: evaluation.status,
          lastMessage: `${evaluation.summary}（已去重，最近事件 ${duplicateEvent.id}）`,
        },
        include: alertRuleInclude,
      });
      await this.alertEventAuditService.writeDedupedAudit(
        teamId,
        userId,
        updatedRule,
        duplicateEvent,
        eventStatus,
        evaluation.summary,
      );
      return { rule: updatedRule, event: duplicateEvent };
    }

    const event = await this.prisma.alertEvent.create({
      data: {
        teamId,
        ruleId: rule.id,
        actorId: userId,
        projectId: rule.projectId,
        environmentId: rule.environmentId,
        applicationId: rule.applicationId,
        applicationServiceId: rule.applicationServiceId,
        serverId: rule.serverId,
        siteId: rule.siteId,
        managedResourceId: rule.managedResourceId,
        backupPlanId: rule.backupPlanId,
        category: rule.category,
        metric: rule.metric,
        severity: rule.severity,
        status: eventStatus,
        value: toJsonValue(evaluation.value),
        condition: rule.condition ? toJsonValue(rule.condition) : undefined,
        summary: eventSummary,
        metadata: eventMetadata ? toJsonValue(eventMetadata) : undefined,
        resolvedAt: eventStatus === 'resolved' ? new Date() : undefined,
      },
      include: alertEventInclude,
    });

    const updatedRule = await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastEvaluatedAt: new Date(),
        lastStatus: evaluation.status,
        lastMessage: evaluation.summary,
      },
      include: alertRuleInclude,
    });

    await this.alertEventAuditService.writeAlertAudit(teamId, userId, updatedRule, event);
    await this.notificationDeliveryDispatchService.dispatchAlertNotifications(teamId, event);
    return { rule: updatedRule, event };
  }

  private async findDuplicateAlertEvent(
    teamId: string,
    rule: AlertRuleRecord,
    eventStatus: string,
  ): Promise<AlertEventRecord | null> {
    if (!dedupeEligibleAlertEventStatuses.includes(eventStatus)) {
      return null;
    }

    const condition = this.asRecord(rule.condition);
    if (this.readBoolean(condition.dedupeEnabled) === false) {
      return null;
    }

    const dedupeWindowMinutes = readPositiveInt(condition.dedupeWindowMinutes, 30, 1, 10080);
    const since = new Date(Date.now() - dedupeWindowMinutes * 60 * 1000);
    return this.prisma.alertEvent.findFirst({
      where: {
        teamId,
        ruleId: rule.id,
        category: rule.category,
        metric: rule.metric,
        status: eventStatus,
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: 'desc' },
      include: alertEventInclude,
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readBoolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }
}
