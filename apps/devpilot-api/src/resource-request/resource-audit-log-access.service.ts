import { Injectable } from '@nestjs/common';
import { ControlAccessPolicyService } from '../control-access-policy';

type AuditLogScopeRef = {
  environmentId?: string | null;
  projectId?: string | null;
} | null;

export type ResourceAuditLogAccessRecord = {
  id: string;
  instance?: AuditLogScopeRef;
  provisioningRun?: AuditLogScopeRef;
  request?: AuditLogScopeRef;
};

@Injectable()
export class ResourceAuditLogAccessService {
  constructor(private readonly accessPolicyService: ControlAccessPolicyService) {}

  async filterReadable(input: {
    actorId: string;
    logs: ResourceAuditLogAccessRecord[];
    teamId: string;
  }) {
    const allowed = await Promise.all(input.logs.map(async (log) => ({
      log,
      allowed: await this.accessPolicyService.canRead({
        teamId: input.teamId,
        actorId: input.actorId,
        ...this.readScope(log),
        category: 'resource_request',
        action: 'resource_audit_log.read',
        targetType: 'resource_audit_log',
        targetId: log.id,
        risk: 'low',
      }),
    })));

    return allowed
      .filter((item) => item.allowed)
      .map((item) => this.stripAccessScope(item.log));
  }

  private readScope(log: ResourceAuditLogAccessRecord) {
    return {
      projectId: log.request?.projectId ??
        log.instance?.projectId ??
        log.provisioningRun?.projectId ??
        null,
      environmentId: log.request?.environmentId ??
        log.instance?.environmentId ??
        log.provisioningRun?.environmentId ??
        null,
    };
  }

  private stripAccessScope(log: ResourceAuditLogAccessRecord) {
    const { instance, provisioningRun, request, ...visibleLog } = log;
    return visibleLog;
  }
}
