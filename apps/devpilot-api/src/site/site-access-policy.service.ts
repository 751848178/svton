/**
 * Site access-policy helper service.
 *
 * Owns the read/write authorization assertions and readable-record filtering
 * that the site routes need. Extracted from `SiteController` so the controllers
 * stay thin route layers. Behavior preserved verbatim.
 */

import { Injectable } from '@nestjs/common';
import { ControlAccessPolicyService } from '../control-access-policy';

export interface SiteAuthRequest {
  user: { id: string };
  teamId: string;
}

export type ReadableSiteRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
};

@Injectable()
export class SiteAccessPolicyService {
  constructor(private readonly accessPolicyService: ControlAccessPolicyService) {}

  assertCanWriteSite(
    req: SiteAuthRequest,
    action: string,
    siteId: string,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId, actorId: req.user.id, projectId, environmentId,
      category: 'site', action, targetType: 'site', targetId: siteId, risk,
    });
  }

  assertCanReadSite(
    req: SiteAuthRequest,
    action: string,
    siteId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    targetType: string = 'site',
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId, actorId: req.user.id, projectId, environmentId,
      category: 'site', action, targetType, targetId: siteId, risk: 'low',
    });
  }

  async filterReadableSiteRecords<T extends ReadableSiteRecord>(
    req: SiteAuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(records.map(async (record) => ({
      record,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId, actorId: req.user.id, projectId: record.projectId, environmentId: record.environmentId,
        category: 'site', action, targetType, targetId: record.id, risk: 'low',
      }),
    })));
    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }
}
