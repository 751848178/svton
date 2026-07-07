/**
 * Resource-control access-policy helper service.
 *
 * Owns the read/write authorization assertions and the readable-record
 * filtering that the resource-control routes need. Extracted from
 * `ResourceControlController` so the controller stays a thin route layer.
 * Behavior preserved verbatim.
 */

import { Injectable } from '@nestjs/common';
import { ControlAccessPolicyService } from '../control-access-policy';

export interface ResourceControlAuthRequest {
  user: { id: string };
  teamId: string;
}

export type ReadableResourceRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  resource?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  metadata?: unknown;
};

@Injectable()
export class ResourceControlAccessPolicyService {
  constructor(private readonly accessPolicyService: ControlAccessPolicyService) {}

  assertCanWriteResource(
    req: ResourceControlAuthRequest,
    action: string,
    resourceId: string,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
    subAction?: string,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource',
      action: subAction ? `${action}.${subAction}` : action,
      targetType: 'managed_resource',
      targetId: resourceId,
      risk,
    });
  }

  assertCanReadResource(
    req: ResourceControlAuthRequest,
    action: string,
    targetId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    targetType: string = 'managed_resource',
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource',
      action,
      targetType,
      targetId,
      risk: 'low',
    });
  }

  async filterReadableResourceRecords<T extends ReadableResourceRecord>(
    req: ResourceControlAuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(records.map(async (record) => {
      const scope = this.getReadableResourceScope(record);
      return {
        record,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: scope.projectId,
          environmentId: scope.environmentId,
          category: 'resource',
          action,
          targetType,
          targetId: record.id,
          risk: 'low',
        }),
      };
    }));
    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }

  getReadableResourceScope(record: ReadableResourceRecord) {
    const metadataScope = this.getMetadataAccessScope(record.metadata);
    return {
      projectId: record.projectId ?? record.resource?.projectId ?? metadataScope.projectId,
      environmentId: record.environmentId ?? record.resource?.environmentId ?? metadataScope.environmentId,
    };
  }

  getMetadataAccessScope(metadata: unknown) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { projectId: null, environmentId: null };
    }
    const value = metadata as Record<string, unknown>;
    return {
      projectId: typeof value.projectId === 'string' ? value.projectId : null,
      environmentId: typeof value.environmentId === 'string' ? value.environmentId : null,
    };
  }

  assertCanSyncDocker(
    req: ResourceControlAuthRequest,
    serverId: string,
    projectId?: string | null,
    environmentId?: string | null,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource',
      action: 'resource.sync_docker',
      targetType: 'server',
      targetId: serverId,
      risk: 'medium',
    });
  }

  assertCanSyncCloud(req: ResourceControlAuthRequest, provider: string | undefined, projectId?: string | null, environmentId?: string | null) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource',
      action: 'resource.sync_cloud',
      targetType: 'cloud_resources',
      targetId: provider || 'all',
      risk: 'medium',
    });
  }
}
