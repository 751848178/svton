export type LogStreamTargetContext = {
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  deploymentRunId?: string | null;
  backupPlanId?: string | null;
  backupRunId?: string | null;
  alertEventId?: string | null;
  sourceType?: string;
};
