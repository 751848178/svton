import { Prisma } from '@prisma/client';
import type { alertRuleInclude } from './monitoring-alert-rule.constants';

export type AlertRuleRecord = Prisma.AlertRuleGetPayload<{
  include: typeof alertRuleInclude;
}>;

export type AlertRuleTargetContext = {
  category?: string;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  backupPlanId?: string | null;
};
