/** 监控域类型 - 基础实体与告警接口。 */

export interface Project {
  id: string;
  name: string;
}

export interface ApplicationServiceItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  environment?: { id: string; key: string; name: string; status: string } | null;
  server?: { id: string; name: string; host: string } | null;
}

export interface ApplicationItem {
  id: string;
  name: string;
  projectId: string;
  project?: Project | null;
  services: ApplicationServiceItem[];
}

export interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

export interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  status: string;
}

export interface ManagedResource {
  id: string;
  name: string;
  sourceType: string;
  provider: string;
  kind: string;
  status: string;
}

export interface BackupPlan {
  id: string;
  name: string;
  status: string;
  lastStatus?: string | null;
}

export interface AlertRule {
  id: string;
  name: string;
  category: string;
  metric: string;
  severity: string;
  enabled: boolean;
  evaluationMode: string;
  intervalSeconds: number;
  condition?: Record<string, unknown> | null;
  lastStatus?: string | null;
  lastMessage?: string | null;
  lastEvaluatedAt?: string | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
  backupPlan?: BackupPlan | null;
  events?: Array<{
    id: string;
    status: string;
    severity: string;
    summary?: string | null;
    occurredAt: string;
  }>;
}

export interface AlertEvent {
  id: string;
  category: string;
  metric: string;
  severity: string;
  status: string;
  summary?: string | null;
  occurredAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  rule?: { id: string; name: string; metric: string; severity: string; enabled: boolean } | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
  applicationService?: { id: string; name: string; kind: string; status: string } | null;
  server?: Server | null;
  site?: Site | null;
  managedResource?: ManagedResource | null;
  backupPlan?: BackupPlan | null;
}

export interface AlertSilence {
  id: string;
  name: string;
  status: string;
  projectId?: string | null;
  environmentId?: string | null;
  category?: string | null;
  metric?: string | null;
  severityFilter?: string[] | null;
  startsAt: string;
  endsAt?: string | null;
  reason?: string | null;
  project?: Project | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
}

export interface AlertNotificationChannel {
  id: string;
  name: string;
  type: string;
  status: string;
  projectId?: string | null;
  environmentId?: string | null;
  config?: {
    target?: string;
    method?: string;
    liveEnabled?: boolean;
    recipientCount?: number;
    subjectPrefix?: string;
  } | null;
  eventStatuses?: string[] | null;
  severityFilter?: string[] | null;
  lastStatus?: string | null;
  lastDeliveredAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export interface AlertNotificationDelivery {
  id: string;
  channelId: string;
  alertEventId: string;
  channelType: string;
  status: string;
  dryRun: boolean;
  target?: string | null;
  responseStatus?: number | null;
  error?: string | null;
  attemptedAt?: string | null;
  createdAt: string;
  channel?: {
    id: string;
    name: string;
    type: string;
    status: string;
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  alertEvent?: {
    id: string;
    category: string;
    metric: string;
    severity: string;
    status: string;
    summary?: string | null;
    occurredAt: string;
    rule?: { id: string; name: string } | null;
  } | null;
}
